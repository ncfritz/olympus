import { describe, expect, it } from "vitest";
import { decodeBase64Url } from "../../src/base64url";

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
