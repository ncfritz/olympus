import { describe, expect, it } from "vitest";
import {
  codeChallengeFor,
  isWellFormedVerifier,
  verifierMatches,
} from "../../../../src/auth/codes/pkce";

// RFC 7636, Appendix B.
const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("codeChallengeFor", () => {
  it("agrees with the RFC's own test vector", () => {
    expect(codeChallengeFor(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
  });

  it("is base64url: no padding, no + or /", () => {
    const challenge = codeChallengeFor("a".repeat(43));
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("isWellFormedVerifier", () => {
  it.each([
    ["the RFC's vector", RFC_VERIFIER, true],
    ["the shortest allowed", "a".repeat(43), true],
    ["the longest allowed", "a".repeat(128), true],
    ["one character short", "a".repeat(42), false],
    ["one character long", "a".repeat(129), false],
    ["empty", "", false],
    ["a character outside the unreserved set", `${"a".repeat(42)}+`, false],
    ["a space", `${"a".repeat(42)} `, false],
  ])("%s", (_what, verifier, expected) => {
    expect(isWellFormedVerifier(verifier)).toBe(expected);
  });
});

describe("verifierMatches", () => {
  it("accepts the verifier that produced the challenge", () => {
    expect(verifierMatches(RFC_VERIFIER, RFC_CHALLENGE)).toBe(true);
  });

  it("refuses another verifier", () => {
    expect(verifierMatches("b".repeat(43), RFC_CHALLENGE)).toBe(false);
  });

  it("refuses a malformed verifier before hashing it", () => {
    expect(verifierMatches("short", codeChallengeFor("short"))).toBe(false);
  });

  it("refuses `plain`, where the challenge is the verifier itself", () => {
    // RFC 7636 permits this; we do not, because the authorization request
    // travels through a browser redirect where it can be observed.
    expect(verifierMatches(RFC_VERIFIER, RFC_VERIFIER)).toBe(false);
  });

  it("refuses a challenge of another length without throwing", () => {
    // timingSafeEqual throws on differing lengths; the guard is deliberate.
    expect(() => verifierMatches(RFC_VERIFIER, "short")).not.toThrow();
    expect(verifierMatches(RFC_VERIFIER, "short")).toBe(false);
  });
});
