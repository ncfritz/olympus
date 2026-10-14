import { mutate } from "swr";
import { API_URL, apiClient, BASE_PATH } from "./api/client";
import { KEYS } from "./api/queries";

/**
 * The recent sign-in (ADR 0020): ceremonies, changes to CAs, profiles and
 * deploy targets, and key export want a sign-in from the last few minutes
 * (AUTH_RECENT_SIGN_IN_SECONDS). The service says until when the current
 * one is recent enough; this counts down to it, and signs in again in a
 * small window so the page, and whatever was typed on it, stays as it is.
 */

/** The last stretch, in which the countdown and the notice turn amber. */
export const ENDING_MS = 60_000;

export type RecentState = "open" | "ending" | "lapsed";

export type Recent = {
  state: RecentState;
  /** Milliseconds left, never below zero. */
  remainingMs: number;
  /** Of the whole window, what is left: 1 at sign-in, 0 when lapsed. */
  fraction: number;
};

/**
 * Where the recent sign-in stands at `now`; undefined when the service
 * did not say (one older than the console), so nothing counts down.
 */
export const recentOf = (
  signedInAt: string | undefined,
  recentUntil: string | undefined,
  now: number,
): Recent | undefined => {
  const start = Date.parse(signedInAt ?? "");
  const end = Date.parse(recentUntil ?? "");
  if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
  const remainingMs = Math.max(0, end - now);
  const whole = Math.max(1, end - start);
  return {
    state:
      remainingMs === 0
        ? "lapsed"
        : remainingMs <= ENDING_MS
          ? "ending"
          : "open",
    remainingMs,
    fraction: Math.min(1, remainingMs / whole),
  };
};

/** 3:12, or 0:42. */
export const clockOf = (ms: number): string => {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** The page the sign-in window comes back to: it says so, and closes. */
export const SIGNED_IN_PATH = "/signed-in";

/** How the sign-in window tells the page that opened it. */
const CHANNEL = "harpocrates-sign-in";

/** Signing in, coming back to `returnTo` (this page, by default). */
export const signInHref = (returnTo?: string): string => {
  const back =
    returnTo ?? (typeof window === "undefined" ? "" : window.location.href);
  return `${API_URL}/auth/login/google?returnTo=${encodeURIComponent(back)}`;
};

/** Called by the sign-in window's page: done, whoever is waiting. */
export const announceSignedIn = (): void => {
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage("signed-in");
  channel.close();
};

/** How long a save waits on the sign-in window before giving up. */
const WAIT_MS = 3 * 60_000;

/** How a sign-in in the window ended. */
export type SignInResult = "signed-in" | "blocked" | "gave-up";

let pending: Promise<SignInResult> | undefined;

/**
 * Signs in again in a small window: "signed-in" once it has, with the
 * current user read again; "blocked" if the browser would not open the
 * window; "gave-up" if nothing came back within a few minutes. One sign-in at a time: asked
 * again while one is waiting, the window is brought back and the same
 * wait goes on.
 *
 * Opened from a click, or soon after one, a browser lets it through; one
 * that blocks it leaves the page as it is, for a click on "Sign in again".
 * Whether the window was closed is not asked: once it has been to the
 * provider, a browser may cut it off from this page and say it is closed
 * while the person is still signing in.
 */
export const signInAgain = (): Promise<SignInResult> => {
  const back = new URL(`${BASE_PATH}${SIGNED_IN_PATH}`, window.location.origin)
    .href;
  const popup = window.open(
    signInHref(back),
    CHANNEL,
    "popup,width=520,height=680",
  );
  if (pending) return pending;
  if (!popup) return Promise.resolve("blocked");
  pending = new Promise<SignInResult>((resolve) => {
    const channel = new BroadcastChannel(CHANNEL);
    const finish = (result: SignInResult) => {
      channel.close();
      window.clearTimeout(timeout);
      pending = undefined;
      resolve(result);
    };
    channel.onmessage = () => {
      void mutate(KEYS.user).then(() => finish("signed-in"));
    };
    const timeout = window.setTimeout(() => finish("gave-up"), WAIT_MS);
  });
  return pending;
};

const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Each write as it was sent, to send again after signing in. */
const sent = new Map<string, Request>();

/**
 * A write refused for wanting a recent sign-in is not handed back: the
 * sign-in window opens, and once it has signed in the same request goes
 * again, so whatever was typed is saved rather than lost. If the window
 * cannot open, the refusal is handed back as it was, and the page offers
 * "Sign in again" (ErrorAlert).
 */
apiClient.use({
  onRequest({ request, id }) {
    if (WRITES.has(request.method)) sent.set(id, request.clone());
    return undefined;
  },
  async onResponse({ response, id }) {
    const copy = sent.get(id);
    sent.delete(id);
    if (!copy || response.status !== 403) return undefined;
    const body = (await response
      .clone()
      .json()
      .catch(() => undefined)) as { message?: unknown } | undefined;
    if (!/recent sign-in/.test(String(body?.message ?? ""))) return undefined;
    return (await signInAgain()) === "signed-in" ? fetch(copy) : undefined;
  },
  onError({ id }) {
    sent.delete(id);
    return undefined;
  },
});
