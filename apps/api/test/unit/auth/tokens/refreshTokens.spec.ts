import { describe, expect, it } from "vitest";
import {
  hashesMatch,
  hashRefreshToken,
  newRefreshToken,
  REFRESH_TOKEN_DAYS,
} from "../../../../src/auth/tokens/refreshTokens";

describe("newRefreshToken", () => {
  it("is 256 bits of base64url", () => {
    expect(newRefreshToken().token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("does not repeat", () => {
    const tokens = new Set(
      Array.from({ length: 500 }, () => newRefreshToken().token),
    );
    expect(tokens.size).toBe(500);
  });

  it("expires in thirty days", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    expect(newRefreshToken(now).expiresAt.toISOString()).toBe(
      "2026-10-25T12:00:00.000Z",
    );
    expect(REFRESH_TOKEN_DAYS).toBe(30);
  });

  it("carries the hash of the token it returns", () => {
    const { token, hash } = newRefreshToken();
    expect(hash).toBe(hashRefreshToken(token));
    // The stored form must not be the token: a copy of the table would
    // otherwise be a set of working credentials.
    expect(hash).not.toBe(token);
  });
});

describe("hashRefreshToken", () => {
  it("is stable for the same token", () => {
    expect(hashRefreshToken("abc")).toBe(hashRefreshToken("abc"));
  });

  it("differs for different tokens", () => {
    expect(hashRefreshToken("abc")).not.toBe(hashRefreshToken("abd"));
  });

  it("is base64url of a SHA-256 digest", () => {
    expect(hashRefreshToken("abc")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("hashesMatch", () => {
  it("accepts equal hashes", () => {
    expect(hashesMatch(hashRefreshToken("a"), hashRefreshToken("a"))).toBe(
      true,
    );
  });

  it("refuses different hashes", () => {
    expect(hashesMatch(hashRefreshToken("a"), hashRefreshToken("b"))).toBe(
      false,
    );
  });

  it("refuses different lengths without throwing", () => {
    // timingSafeEqual throws on a length mismatch; the guard is deliberate.
    expect(() => hashesMatch("short", hashRefreshToken("a"))).not.toThrow();
    expect(hashesMatch("short", hashRefreshToken("a"))).toBe(false);
  });
});
