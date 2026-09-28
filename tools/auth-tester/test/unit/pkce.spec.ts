import { describe, expect, it } from "vitest";
import { challengeFor, newState, newVerifier } from "../../src/pkce";

/** The regex the API checks a challenge against. */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

describe("pkce", () => {
  it("makes a verifier the API will accept a challenge for", () => {
    const verifier = newVerifier();
    // RFC 7636 4.1: 43 to 128 characters from the unreserved set.
    expect(verifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
    expect(challengeFor(verifier)).toMatch(CHALLENGE);
  });

  /** RFC 7636 appendix B, so this is checked against the specification. */
  it("derives the challenge the specification's example gives", () => {
    expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("does not repeat a verifier or a state", () => {
    expect(newVerifier()).not.toBe(newVerifier());
    expect(newState()).not.toBe(newState());
  });
});
