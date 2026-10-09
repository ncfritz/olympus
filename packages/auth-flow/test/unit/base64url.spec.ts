import { describe, expect, it } from "vitest";
import {
  base64ToBase64Url,
  decodeBase64Url,
  encodeBase64Url,
} from "../../src/base64url";

/**
 * Hand-rolled because React Native has neither `Buffer` nor a dependable
 * `atob`, so this is checked against Node's answer rather than trusted.
 */
describe("decodeBase64Url", () => {
  it("agrees with Node for text, JSON and multi-byte characters", () => {
    for (const text of [
      "",
      "a",
      "ab",
      "abc",
      '{"sub":"user-1","roles":["admin"]}',
      "émile — naïve ☃",
      "𝄞 clef",
      "?ü/+_-=",
    ]) {
      const encoded = Buffer.from(text, "utf8").toString("base64url");
      expect(decodeBase64Url(encoded)).toBe(text);
    }
  });

  it("refuses characters that are not base64url", () => {
    // `+` and `/` are base64's, not base64url's: a token with them in is not
    // one this decoder should quietly accept.
    expect(() => decodeBase64Url("ab+c")).toThrow(/not base64url/);
    expect(() => decodeBase64Url("ab/c")).toThrow(/not base64url/);
  });
});

/** Checked against Node's answer, since the platforms that need this have none. */
describe("encodeBase64Url", () => {
  it("agrees with Node for every length that exercises the padding cases", () => {
    for (let length = 0; length <= 64; length += 1) {
      const bytes = Uint8Array.from(
        { length },
        (_unused, at) => (at * 37) % 256,
      );
      expect(encodeBase64Url(bytes)).toBe(
        Buffer.from(bytes).toString("base64url"),
      );
    }
  });

  /** 32 random bytes is RFC 7636's 43 characters, which is what PKCE wants. */
  it("turns 32 bytes into a 43-character verifier", () => {
    expect(encodeBase64Url(new Uint8Array(32))).toHaveLength(43);
    expect(encodeBase64Url(new Uint8Array(32))).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("round-trips through the decoder", () => {
    const text = "sub=user-1 — ☃";
    const bytes = [...Buffer.from(text, "utf8")];
    expect(decodeBase64Url(encodeBase64Url(bytes))).toBe(text);
  });
});

describe("base64ToBase64Url", () => {
  /** expo-crypto digests to padded base64; a challenge must be base64url. */
  it("swaps the two characters and drops the padding", () => {
    expect(base64ToBase64Url("ab+c/d==")).toBe("ab-c_d");
    expect(
      base64ToBase64Url("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw+cM="),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
