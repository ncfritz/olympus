import { createHash, randomBytes } from "crypto";
import { describe, expect, it } from "vitest";
import { createPkce, type FlowCrypto } from "../../src/pkce";

/**
 * Node's adapter, written here rather than mocked: what this package needs
 * from a platform is small enough that proving it works against a real
 * implementation is cheaper than pretending.
 */
const node: FlowCrypto = {
  randomBase64Url: (bytes) => randomBytes(bytes).toString("base64url"),
  sha256Base64Url: (text) =>
    createHash("sha256").update(text).digest("base64url"),
};

/** The regex the API checks a challenge against. */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

describe("createPkce", () => {
  const pkce = createPkce(node);

  it("makes a verifier the API will accept a challenge for", async () => {
    const verifier = await pkce.newVerifier();
    // RFC 7636 4.1: 43 to 128 characters from the unreserved set.
    expect(verifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
    expect(await pkce.challengeFor(verifier)).toMatch(CHALLENGE);
  });

  /** RFC 7636 appendix B, so this is checked against the specification. */
  it("derives the challenge the specification's example gives", async () => {
    expect(
      await pkce.challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("does not repeat a verifier or a state", async () => {
    expect(await pkce.newVerifier()).not.toBe(await pkce.newVerifier());
    expect(await pkce.newState()).not.toBe(await pkce.newState());
  });

  /** An asynchronous platform is the normal case, not the exception. */
  it("takes a crypto whose answers are promises", async () => {
    const promised = createPkce({
      randomBase64Url: async (bytes) => node.randomBase64Url(bytes),
      sha256Base64Url: async (text) => node.sha256Base64Url(text),
    });
    expect(await promised.challengeFor("a".repeat(43))).toMatch(CHALLENGE);
  });
});
