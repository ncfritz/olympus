import { describe, expect, it } from "vitest";
import { afterIssue, expired, type SavedTokens } from "../../src";

const ISSUED = {
  accessToken: "access-2",
  expiresIn: 600,
  refreshToken: "refresh-2",
};

const SAVED: SavedTokens = {
  apiBaseUrl: "http://localhost:3001/v1",
  clientId: "olympus-auth-tester",
  provider: "google",
  accessToken: "access-1",
  accessTokenExpiresAt: 1_000_000,
  refreshToken: "refresh-1",
  sessionId: "session-1",
  savedAt: "2026-09-27T00:00:00.000Z",
};

describe("afterIssue", () => {
  it("keeps the token it replaced, which is what a replay presents", () => {
    const next = afterIssue(SAVED, ISSUED, 2_000_000);
    expect(next.refreshToken).toBe("refresh-2");
    expect(next.previousRefreshToken).toBe("refresh-1");
    // The same session across a rotation: rotating does not start one.
    expect(next.sessionId).toBe("session-1");
    expect(next.accessTokenExpiresAt).toBe(2_000_000 + 600_000);
  });

  it("has no previous token the first time, at sign-in", () => {
    const first = afterIssue(
      {
        apiBaseUrl: SAVED.apiBaseUrl,
        clientId: SAVED.clientId,
        provider: SAVED.provider,
      },
      ISSUED,
      2_000_000,
    );
    expect(first.previousRefreshToken).toBeUndefined();
  });
});

describe("expired", () => {
  const at = (accessTokenExpiresAt: number): SavedTokens => ({
    ...SAVED,
    accessTokenExpiresAt,
  });

  it("counts a token with seconds left as spent", () => {
    // The margin is the call itself: a token that expires while the request
    // is in flight is refused as surely as one that expired a minute ago.
    expect(expired(at(1_000_000), 1_000_000 - 29_000)).toBe(true);
    expect(expired(at(1_000_000), 1_000_000 - 31_000)).toBe(false);
  });
});
