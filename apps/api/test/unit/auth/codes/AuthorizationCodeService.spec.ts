import { describe, expect, it } from "vitest";
import {
  AuthorizationCodeService,
  type AuthorizationCode,
  type PendingAuthorization,
} from "../../../../src/auth/codes/AuthorizationCodeService";
import { codeChallengeFor } from "../../../../src/auth/codes/pkce";

const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = codeChallengeFor(VERIFIER);

const pending = (): PendingAuthorization => ({
  clientId: "olympus-site",
  redirectUri: "https://olympus.ncfritz.net/auth/callback",
  clientState: "the-client's-state",
  codeChallenge: CHALLENGE,
  provider: "google",
  providerVerifier: "v".repeat(43),
  providerNonce: "n".repeat(43),
});

const issued = (): AuthorizationCode => ({
  clientId: "olympus-site",
  redirectUri: "https://olympus.ncfritz.net/auth/callback",
  codeChallenge: CHALLENGE,
  userId: "5f1a0c6e-0000-4000-8000-000000000001",
  authTime: 1_790_000_000,
});

describe("pending authorizations", () => {
  it("returns what it was given, once", () => {
    const service = new AuthorizationCodeService();
    const state = service.beginAuthorization(pending());
    expect(service.takeAuthorization(state)).toEqual(pending());
    // A provider callback replayed finds nothing.
    expect(service.takeAuthorization(state)).toBeUndefined();
  });

  it("gives every sign-in a different state", () => {
    const service = new AuthorizationCodeService();
    const states = new Set(
      Array.from({ length: 50 }, () => service.beginAuthorization(pending())),
    );
    expect(states.size).toBe(50);
    for (const state of states) expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("does not return an unknown state", () => {
    expect(
      new AuthorizationCodeService().takeAuthorization("nope"),
    ).toBeUndefined();
  });
});

describe("redeeming a code", () => {
  const service = () => {
    const codes = new AuthorizationCodeService();
    return { codes, value: codes.issueCode(issued()) };
  };

  it("yields the sign-in behind it", () => {
    const { codes, value } = service();
    expect(
      codes.redeem(value, "olympus-site", issued().redirectUri, VERIFIER),
    ).toEqual({ code: issued() });
  });

  it("can be redeemed only once", () => {
    const { codes, value } = service();
    codes.redeem(value, "olympus-site", issued().redirectUri, VERIFIER);
    expect(
      codes.redeem(value, "olympus-site", issued().redirectUri, VERIFIER),
    ).toEqual({ reason: "unknown or expired code" });
  });

  it("refuses a code presented by another client", () => {
    const { codes, value } = service();
    expect(
      codes.redeem(value, "olympus-ios", issued().redirectUri, VERIFIER),
    ).toEqual({ reason: 'code was issued to "olympus-site"' });
  });

  it("refuses a redirect_uri that is not the one it was issued for", () => {
    const { codes, value } = service();
    expect(
      codes.redeem(value, "olympus-site", "https://evil.example/cb", VERIFIER),
    ).toEqual({ reason: "redirect_uri does not match the code's" });
  });

  it("refuses the wrong verifier — the point of PKCE", () => {
    const { codes, value } = service();
    expect(
      codes.redeem(value, "olympus-site", issued().redirectUri, "b".repeat(43)),
    ).toEqual({ reason: "code_verifier does not match the challenge" });
  });

  it("refuses an unknown code", () => {
    expect(
      new AuthorizationCodeService().redeem(
        "never-issued",
        "olympus-site",
        issued().redirectUri,
        VERIFIER,
      ),
    ).toEqual({ reason: "unknown or expired code" });
  });

  it("consumes the code even when the verifier is wrong", () => {
    // One guess per code: a wrong verifier must not leave it redeemable.
    const { codes, value } = service();
    codes.redeem(value, "olympus-site", issued().redirectUri, "b".repeat(43));
    expect(
      codes.redeem(value, "olympus-site", issued().redirectUri, VERIFIER),
    ).toEqual({ reason: "unknown or expired code" });
  });
});
