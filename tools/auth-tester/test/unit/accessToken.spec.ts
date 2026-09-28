import { describe, expect, it, vi } from "vitest";
import { accessTokenProvider } from "../../src/accessToken";
import type { IssuedTokens } from "../../src/oauth";
import { type SavedTokens, TokenStore } from "../../src/tokenStore";

const SAVED: SavedTokens = {
  apiBaseUrl: "http://localhost:3001/v1",
  clientId: "olympus-auth-tester",
  provider: "google",
  accessToken: "the-stored-token",
  accessTokenExpiresAt: Date.now() + 600_000,
  refreshToken: "the-stored-refresh-token",
  savedAt: "2026-09-27T00:00:00.000Z",
};

/** A store in memory: this is about the provider, not about the file. */
const storing = (saved: SavedTokens | undefined) => {
  let held = saved;
  return {
    read: () => held,
    save: (tokens: SavedTokens) => {
      held = tokens;
    },
    get held() {
      return held;
    },
  } as unknown as TokenStore & { held: SavedTokens | undefined };
};

const ROTATED: IssuedTokens = {
  accessToken: "a-rotated-token",
  expiresIn: 600,
  refreshToken: "a-rotated-refresh-token",
};

describe("accessTokenProvider", () => {
  it("sends nothing when nobody is signed in", async () => {
    const refresh = vi.fn();
    expect(
      await accessTokenProvider(storing(undefined), refresh, {
        stale: false,
      })(),
    ).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("uses the stored token while it is good", async () => {
    const refresh = vi.fn();
    expect(
      await accessTokenProvider(storing(SAVED), refresh, { stale: false })(),
    ).toBe("the-stored-token");
    expect(refresh).not.toHaveBeenCalled();
  });

  /**
   * The case a CLI is always in: an access token lives ten minutes and the
   * next command is run an hour later.
   */
  it("rotates an expired token and keeps the rotation", async () => {
    const store = storing({ ...SAVED, accessTokenExpiresAt: Date.now() - 1 });
    const refresh = vi.fn(async () => ROTATED);

    expect(await accessTokenProvider(store, refresh, { stale: false })()).toBe(
      "a-rotated-token",
    );
    expect(refresh).toHaveBeenCalledWith("the-stored-refresh-token");
    expect(store.held?.refreshToken).toBe("a-rotated-refresh-token");
    expect(store.held?.previousRefreshToken).toBe("the-stored-refresh-token");
  });

  it("sends the expired token unchanged with --stale", async () => {
    const refresh = vi.fn();
    const expiredTokens = { ...SAVED, accessTokenExpiresAt: Date.now() - 1 };
    expect(
      await accessTokenProvider(storing(expiredTokens), refresh, {
        stale: true,
      })(),
    ).toBe("the-stored-token");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says to sign in again when the rotation is refused", async () => {
    const refresh = vi.fn(async () => {
      throw new Error("the API refused: invalid_grant");
    });
    await expect(
      accessTokenProvider(
        storing({ ...SAVED, accessTokenExpiresAt: Date.now() - 1 }),
        refresh,
        { stale: false },
      )(),
    ).rejects.toThrow(/invalid_grant.*Run login/s);
  });
});
