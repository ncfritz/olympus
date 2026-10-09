import type { IssuedAccess } from "@ncfritz/olympus-auth-flow";

/** What the page holds between calls: the token, and when it stops working. */
export type Held = {
  accessToken: string;
  /** Milliseconds since the epoch, from `expires_in` when it was issued. */
  expiresAt: number;
};

export type Session = {
  /**
   * The token for the next call, rotated first if it has expired. Undefined
   * when nobody is signed in, which is a caller's cue to send no header at all
   * rather than an empty one.
   */
  token(): Promise<string | undefined>;
  /** Rotates now, whatever the expiry says: what a 401 asks for. */
  renew(): Promise<string | undefined>;
  /** Whether the browser still holds a usable refresh cookie. */
  restore(): Promise<boolean>;
  held(): Held | undefined;
  hold(issued: IssuedAccess | undefined): void;
  /** Called whenever the answer to "signed in?" changes. Returns an unsubscribe. */
  watch(listener: (held: Held | undefined) => void): () => void;
};

/**
 * The access token, in memory, and the one rule that matters: **one rotation at
 * a time.**
 *
 * A page load fires a dozen API calls at once. If each of them noticed the
 * expired token and refreshed, the API would see one refresh token presented
 * repeatedly -- and it cannot tell that from a stolen one, so it ends the
 * session (ADR 0018). Opening the site would sign you out. So every caller that
 * needs a rotation awaits the same one.
 *
 * Nothing is persisted. The refresh token is an httpOnly cookie the browser
 * holds and no script can read, so there is nothing here worth keeping across a
 * reload -- and `restore` is how a fresh page finds out where it stands.
 */
export const createSession = (options: {
  /** `refreshFromCookie`, bound to this API. */
  refresh: () => Promise<IssuedAccess>;
  /** Treats the token as spent this many milliseconds early (default 30s). */
  margin?: number;
  now?: () => number;
}): Session => {
  const now = options.now ?? (() => Date.now());
  const margin = options.margin ?? 30_000;

  let held: Held | undefined;
  let rotating: Promise<Held | undefined> | undefined;
  const listeners = new Set<(held: Held | undefined) => void>();

  const announce = () => {
    for (const listener of listeners) listener(held);
  };

  const set = (issued: IssuedAccess | undefined) => {
    held =
      issued === undefined
        ? undefined
        : {
            accessToken: issued.accessToken,
            expiresAt: now() + issued.expiresIn * 1000,
          };
    announce();
  };

  /** One rotation, shared by everyone who asked while it was in flight. */
  const rotate = (): Promise<Held | undefined> => {
    rotating ??= (async () => {
      try {
        set(await options.refresh());
        return held;
      } catch {
        // The cookie is gone, revoked or expired. Not an error to throw at a
        // caller who only wanted a token: it is the answer "signed out".
        set(undefined);
        return undefined;
      } finally {
        rotating = undefined;
      }
    })();
    return rotating;
  };

  const spent = (): boolean =>
    held === undefined || held.expiresAt - margin <= now();

  return {
    token: async () => {
      if (!spent()) return held?.accessToken;
      return (await rotate())?.accessToken;
    },
    renew: async () => (await rotate())?.accessToken,
    restore: async () => (await rotate()) !== undefined,
    held: () => held,
    hold: (issued) => {
      set(issued);
    },
    watch: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
