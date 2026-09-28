import {
  checkReuseDetection,
  type FormAnswer,
  oauthError,
  refreshTokens,
  type ReuseVerdict,
} from "@ncfritz/olympus-auth-flow";
import { AuthApi, createOlympusClients } from "@ncfritz/olympus-client";
import { CLIENT_ID, formPoster } from "./signIn";
import { createSession, type Session } from "./session";
import type { SavedTokens } from "@ncfritz/olympus-auth-flow";

export type Called = {
  method: string;
  path: string;
  status?: number;
  /** Milliseconds, as the app saw them: the round trip plus any rotation. */
  took: number;
  /** A line of what came back, or what went wrong. */
  answer: string;
};

export type Caller = {
  session: Session;
  auth: AuthApi;
  /** Any path, relative to the base URL, with the access token attached. */
  get(path: string): Promise<Called>;
  /** The endpoints that answer about the caller, each as a log line. */
  whoami(): Promise<Called>;
  /** The caller's sessions: the log line, and the list to show. */
  sessions(): Promise<{ called: Called; listed: Listed[] }>;
  /** Rotates now, whether or not the access token has expired. */
  refresh(): Promise<Called>;
  /**
   * Presents the token the last rotation replaced, then the live one. Both
   * dead afterwards unless the verdict says otherwise.
   */
  replay(): Promise<{ called: Called; verdict: ReuseVerdict }>;
  /** Ends one of the caller's sessions; its own is allowed. */
  revoke(sessionId: string): Promise<{ called: Called; itsOwn: boolean }>;
  /** Ends the session these tokens came from, at the API. */
  signOut(): Promise<Called>;
};

/** A session as the screen shows it. */
export type Listed = {
  id: string;
  clientId: string;
  deviceName?: string;
  current: boolean;
  expiresTime: string;
};

/**
 * The clients for one API, with the session's access token on every request.
 *
 * Through `@ncfritz/olympus-client` rather than `fetch`, which is the point of
 * the exercise: the agents and the site use that package, and this is the first
 * thing to use its `auth` option on a phone. The token endpoint is the one
 * exception -- it issues the tokens, so it cannot carry one.
 */
export const createCaller = (options: {
  apiBaseUrl: string;
  persist: (tokens: SavedTokens) => Promise<void>;
  onChange?: (tokens: SavedTokens | undefined) => void;
  stale?: boolean;
}): Caller => {
  const post = formPoster(options.apiBaseUrl);
  const session = createSession({
    refresh: (refreshToken) =>
      refreshTokens(post, { clientId: CLIENT_ID, refreshToken }),
    persist: options.persist,
    ...(options.onChange === undefined ? {} : { onChange: options.onChange }),
    ...(options.stale === undefined ? {} : { stale: options.stale }),
  });

  const clients = createOlympusClients({
    baseUrl: options.apiBaseUrl,
    clientName: CLIENT_ID,
    auth: session.accessToken,
  });

  const timed = async (
    method: string,
    path: string,
    call: () => Promise<unknown>,
  ): Promise<Called> => {
    const started = Date.now();
    try {
      const answer = await call();
      return {
        method,
        path,
        status: 200,
        took: Date.now() - started,
        answer: JSON.stringify(answer),
      };
    } catch (error: unknown) {
      // The SDK throws for a 4xx, and the status is the interesting part: a
      // 401 here means the token was refused, which is a result, not a crash.
      const status = (error as { response?: { status?: unknown } } | undefined)
        ?.response?.status;
      const body = (error as { response?: { data?: unknown } } | undefined)
        ?.response?.data;
      return {
        method,
        path,
        ...(typeof status === "number" ? { status } : {}),
        took: Date.now() - started,
        answer:
          body === undefined
            ? error instanceof Error
              ? error.message
              : String(error)
            : JSON.stringify(body),
      };
    }
  };

  const auth = new AuthApi(clients);

  /** An answer from the token endpoint, in a line. */
  const answered = (answer: FormAnswer): string =>
    `${answer.status} ${oauthError(answer)?.error ?? JSON.stringify(answer.body)}`;

  return {
    session,
    auth,
    get: (path) =>
      timed("GET", path, async () => {
        const response = await clients.olympus.instance.request({
          method: "GET",
          url: path,
          validateStatus: () => true,
        });
        return { status: response.status, body: response.data };
      }),
    whoami: () => timed("GET", "/auth/me", () => auth.describeCurrentUser()),

    sessions: async () => {
      let listed: Listed[] = [];
      const called = await timed("GET", "/auth/sessions", async () => {
        const sessions = await auth.listSessions();
        listed = sessions.map((session) => ({
          id: session.id,
          clientId: session.clientId,
          ...(session.deviceName === undefined
            ? {}
            : { deviceName: session.deviceName }),
          current: session.current,
          expiresTime: session.expiresTime,
        }));
        return sessions;
      });
      return { called, listed };
    },

    // Through the session, so an explicit refresh and one a call triggers are
    // the same rotation, held and written through the same way.
    refresh: async () => {
      const started = Date.now();
      try {
        const next = await session.refreshNow();
        return {
          method: "POST",
          path: "/auth/token",
          status: 200,
          took: Date.now() - started,
          answer: `rotated; sid and auth_time unchanged, and the access token now expires at ${new Date(next.accessTokenExpiresAt).toISOString()}`,
        };
      } catch (error: unknown) {
        return {
          method: "POST",
          path: "/auth/token",
          took: Date.now() - started,
          answer: error instanceof Error ? error.message : String(error),
        };
      }
    },

    replay: async () => {
      const held = session.current();
      const started = Date.now();
      if (held?.previousRefreshToken === undefined) {
        return {
          called: {
            method: "POST",
            path: "/auth/token",
            took: 0,
            answer: "no previous refresh token to replay: refresh once first",
          },
          verdict: "refused-only",
        };
      }
      const checked = await checkReuseDetection(post, {
        clientId: CLIENT_ID,
        previousRefreshToken: held.previousRefreshToken,
        refreshToken: held.refreshToken,
      });
      const said = {
        revoked: `reuse detected: the replay was refused (${answered(checked.replayed)}) and so was the live token (${answered(checked.live)}), so the session is revoked`,
        "refused-only": `the replay was refused (${answered(checked.replayed)}) but the live token still works: the session was NOT revoked`,
        accepted: `the API ISSUED TOKENS for a rotated refresh token (${answered(checked.replayed)}). Reuse detection is not working`,
      }[checked.verdict];
      // Both tokens are dead when the session went, and what the app holds is
      // untrustworthy when the rotated one was honoured.
      if (checked.verdict !== "refused-only") session.hold(undefined);
      return {
        called: {
          method: "POST",
          path: "/auth/token",
          status: checked.replayed.status,
          took: Date.now() - started,
          answer: said,
        },
        verdict: checked.verdict,
      };
    },

    revoke: async (sessionId) => {
      let itsOwn = false;
      const called = await timed(
        "DELETE",
        `/auth/sessions/${sessionId}`,
        async () => {
          const result = await auth.revokeSession(sessionId);
          itsOwn = result.signedOutThisDevice;
          return result;
        },
      );
      // Revoking this device's own session kills the refresh token, though the
      // access token lives out its ten minutes (ADR 0018).
      if (itsOwn) session.hold(undefined);
      return { called, itsOwn };
    },

    signOut: async () => {
      const called = await timed("POST", "/auth/logout", () => auth.signOut());
      session.hold(undefined);
      return called;
    },
  };
};
