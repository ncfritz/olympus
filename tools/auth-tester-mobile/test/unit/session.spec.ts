import type { IssuedTokens, SavedTokens } from "@ncfritz/olympus-auth-flow";
import { describe, expect, it, vi } from "vitest";
import { createSession } from "../../src/session";

const TOKENS: SavedTokens = {
  apiBaseUrl: "https://olympus.dev.ncfritz.net/api/v1",
  clientId: "olympus-auth-tester",
  provider: "google",
  accessToken: "the-held-token",
  accessTokenExpiresAt: 1_000_000,
  refreshToken: "the-held-refresh-token",
  savedAt: "2026-09-28T00:00:00.000Z",
};

const ROTATED: IssuedTokens = {
  accessToken: "a-rotated-token",
  expiresIn: 600,
  refreshToken: "a-rotated-refresh-token",
};

/** Well inside the ten minutes, and well past them. */
const FRESH = TOKENS.accessTokenExpiresAt - 120_000;
const SPENT = TOKENS.accessTokenExpiresAt + 1;

const session = (options: {
  now: number;
  refresh?: () => Promise<IssuedTokens>;
  stale?: boolean;
}) => {
  const persisted: SavedTokens[] = [];
  const refresh = vi.fn(options.refresh ?? (async () => ROTATED));
  const held = createSession({
    refresh,
    persist: async (tokens) => {
      persisted.push(tokens);
    },
    now: () => options.now,
    ...(options.stale === undefined ? {} : { stale: options.stale }),
  });
  return { held, refresh, persisted };
};

describe("createSession", () => {
  it("has no token before it is given one", async () => {
    const { held, refresh } = session({ now: FRESH });
    expect(await held.accessToken()).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("gives out the held token while it is good", async () => {
    const { held, refresh } = session({ now: FRESH });
    held.hold(TOKENS);
    expect(await held.accessToken()).toBe("the-held-token");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rotates a spent token, keeps it, and writes it through", async () => {
    const { held, refresh, persisted } = session({ now: SPENT });
    held.hold(TOKENS);

    expect(await held.accessToken()).toBe("a-rotated-token");
    expect(refresh).toHaveBeenCalledWith("the-held-refresh-token");
    expect(held.current()?.refreshToken).toBe("a-rotated-refresh-token");
    expect(held.current()?.previousRefreshToken).toBe("the-held-refresh-token");
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.accessToken).toBe("a-rotated-token");
  });

  /**
   * The one that matters. Two calls either side of an expiry would each
   * refresh, and the second would present a token the first had rotated away --
   * which the API cannot tell from a stolen one, and answers by ending the
   * session (ADR 0018). So a screen with two buttons pressed quickly would sign
   * itself out.
   */
  it("rotates once for concurrent callers", async () => {
    let release: ((issued: IssuedTokens) => void) | undefined;
    const { held, refresh } = session({
      now: SPENT,
      refresh: () =>
        new Promise<IssuedTokens>((resolve) => {
          release = resolve;
        }),
    });
    held.hold(TOKENS);

    const first = held.accessToken();
    const second = held.accessToken();
    release?.(ROTATED);

    expect(await first).toBe("a-rotated-token");
    expect(await second).toBe("a-rotated-token");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("rotates again once the rotation is over", async () => {
    const { held, refresh } = session({ now: SPENT });
    held.hold(TOKENS);
    await held.accessToken();
    // The rotated token is fresh at SPENT, so this needs a spent one again.
    held.hold({ ...TOKENS, accessToken: "another", refreshToken: "another-r" });
    await held.accessToken();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("sends the spent token unchanged when asked to", async () => {
    const { held, refresh } = session({ now: SPENT, stale: true });
    held.hold(TOKENS);
    expect(await held.accessToken()).toBe("the-held-token");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("lets go, so a sign-out sends no token", async () => {
    const { held } = session({ now: FRESH });
    held.hold(TOKENS);
    held.hold(undefined);
    expect(await held.accessToken()).toBeUndefined();
    expect(held.current()).toBeUndefined();
  });

  it("tells a listener what it now holds", () => {
    const seen: (SavedTokens | undefined)[] = [];
    const held = createSession({
      refresh: async () => ROTATED,
      persist: async () => {},
      onChange: (tokens) => seen.push(tokens),
    });
    held.hold(TOKENS);
    held.hold(undefined);
    expect(seen).toEqual([TOKENS, undefined]);
  });

  describe("refreshNow", () => {
    it("rotates a token that has not expired", async () => {
      const { held, refresh, persisted } = session({ now: FRESH });
      held.hold(TOKENS);

      const next = await held.refreshNow();
      expect(next.accessToken).toBe("a-rotated-token");
      expect(refresh).toHaveBeenCalledWith("the-held-refresh-token");
      expect(persisted).toHaveLength(1);
    });

    /** The button and a call refreshing at once must not both rotate. */
    it("shares the one-at-a-time guard with the provider", async () => {
      let release: ((issued: IssuedTokens) => void) | undefined;
      const { held, refresh } = session({
        now: SPENT,
        refresh: () =>
          new Promise<IssuedTokens>((resolve) => {
            release = resolve;
          }),
      });
      held.hold(TOKENS);

      const byButton = held.refreshNow();
      const byCall = held.accessToken();
      release?.(ROTATED);

      expect((await byButton).accessToken).toBe("a-rotated-token");
      expect(await byCall).toBe("a-rotated-token");
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("says so when there is nothing to refresh", async () => {
      const { held } = session({ now: FRESH });
      await expect(held.refreshNow()).rejects.toThrow(/not signed in/);
    });
  });
});
