/**
 * What a sign-in leaves behind while the browser is away at the provider, and
 * what has to be true when it comes back.
 *
 * Pure, and tested, because this is the security-carrying half of a public
 * client's flow: the `state` check is the client's own guarantee that the
 * callback belongs to the sign-in it started (RFC 6749 §10.12), and the verifier
 * is what makes an intercepted authorization code useless.
 */
export type Pending = {
  verifier: string;
  state: string;
  /** Where the person was going before they were asked to sign in. */
  returnTo: string;
};

/**
 * `sessionStorage`, not `localStorage`: the verifier is good for one sign-in in
 * one tab, and a value that outlives the tab is a value that can be found later.
 */
export const PENDING_KEY = "olympus.auth.pending";

/**
 * Where a completed sign-in may send the browser.
 *
 * Anything else becomes the root, for two reasons. A path under `/auth/` is how
 * a sign-in returns to the page that started it and then asks to sign in again:
 * "Start again" navigates to `/auth/signin`, a sign-in begun from there records
 * it, and the callback sends the browser back to a sign-in page it has just
 * finished with -- which looks exactly like a failure, and was one to read.
 *
 * And this value has been through `sessionStorage`, so it is not trusted to be
 * a path at all: a scheme, a host, or the `//host` form that a browser reads as
 * one, are all refused rather than handed to a redirect.
 */
export const returnableTo = (raw: unknown): string => {
  if (typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw === "/auth" || raw.startsWith("/auth/")) return "/";
  return raw;
};

export const readPending = (raw: string | null): Pending | undefined => {
  if (raw === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const { verifier, state, returnTo } = parsed as Record<string, unknown>;
    if (typeof verifier !== "string" || verifier === "") return undefined;
    if (typeof state !== "string" || state === "") return undefined;
    return {
      verifier,
      state,
      returnTo: returnableTo(returnTo),
    };
  } catch {
    return undefined;
  }
};

export type Callback =
  { code: string; verifier: string; returnTo: string } | { problem: string };

/**
 * Whether a callback may be exchanged.
 *
 * The order is the point: an `error` is reported before anything else is
 * trusted, the `state` is compared before the code is read, and a comparison
 * against a pending request that is not there fails rather than being skipped --
 * a callback nobody asked for is exactly the request this check exists to refuse.
 */
export const checkCallback = (
  params: Record<string, string>,
  pending: Pending | undefined,
): Callback => {
  if (params.error !== undefined) {
    // One code for every reason the API refused; its log says which.
    return {
      problem:
        params.error === "access_denied"
          ? "Sign-in was refused. The API's log says why: no such user, an unverified address, or a disabled one."
          : `Sign-in failed: ${params.error}`,
    };
  }
  if (pending === undefined) {
    return {
      problem:
        "This callback does not belong to a sign-in this tab started. Start again from the sign-in page.",
    };
  }
  if (params.state === undefined || params.state !== pending.state) {
    return {
      problem:
        "The state did not match the sign-in this tab started, so the callback was not trusted.",
    };
  }
  const code = params.code;
  if (code === undefined || code === "") {
    return { problem: "The callback carried no authorization code." };
  }
  return { code, verifier: pending.verifier, returnTo: pending.returnTo };
};

export const isCallbackReady = (
  callback: Callback,
): callback is { code: string; verifier: string; returnTo: string } =>
  !("problem" in callback);
