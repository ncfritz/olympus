import { refreshTokens } from "@ncfritz/olympus-auth-flow";
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
  sessions(): Promise<Called>;
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
    sessions: () => timed("GET", "/auth/sessions", () => auth.listSessions()),
  };
};
