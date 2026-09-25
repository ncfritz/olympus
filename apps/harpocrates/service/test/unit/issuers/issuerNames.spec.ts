import { describe, expect, it } from "vitest";
import {
  distributionUrls,
  issuerCommonName,
  issuerSlug,
} from "../../../src/issuers/issuerNames";

describe("issuer names (ADR 0020, Naming)", () => {
  it("names an issuing CA by realm, purpose, tier, number and generation", () => {
    const parts = {
      tier: "issuing" as const,
      purpose: "TLS",
      number: 1,
      generation: 1,
    };
    expect(issuerCommonName("ncfritz.net", parts)).toBe(
      "ncfritz.net TLS Issuing CA 1 - G1",
    );
    expect(issuerSlug(parts)).toBe("tls-issuing-1-g1");
  });

  it("names a root without a purpose", () => {
    const parts = { tier: "root" as const, number: 1, generation: 2 };
    expect(issuerCommonName("ncfritz.net", parts)).toBe(
      "ncfritz.net Root CA 1 - G2",
    );
    expect(issuerSlug(parts)).toBe("root-1-g2");
  });

  it("slugs a purpose of several words", () => {
    expect(
      issuerSlug({
        tier: "issuing",
        purpose: "SSH User",
        number: 1,
        generation: 1,
      }),
    ).toBe("ssh-user-issuing-1-g1");
  });

  it("publishes by slug", () => {
    expect(
      distributionUrls("http://pki.internal.ncfritz.net", "tls-issuing-1-g1"),
    ).toEqual({
      crlUrl: "http://pki.internal.ncfritz.net/crl/tls-issuing-1-g1.crl",
      caIssuersUrl: "http://pki.internal.ncfritz.net/ca/tls-issuing-1-g1.crt",
    });
  });
});
