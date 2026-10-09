import { describe, expect, it } from "vitest";
import { identifyPeerCertificate } from "../../../src/mtls/peerCertificate";

const socket = (certificate: unknown) => ({
  getPeerCertificate: () => certificate,
});

describe("identifyPeerCertificate", () => {
  it("names the service and its deployment", () => {
    expect(
      identifyPeerCertificate(
        socket({ subject: { CN: "olympus-api", OU: "prod" } }),
      ),
    ).toEqual({ name: "olympus-api", deployment: "prod" });
  });

  it("takes the first of a repeated attribute", () => {
    expect(
      identifyPeerCertificate(socket({ subject: { CN: ["a", "b"] } })),
    ).toEqual({ name: "a", deployment: undefined });
  });

  it.each([
    ["no socket", undefined, "not a TLS connection"],
    ["a plain socket", {}, "not a TLS connection"],
    ["no certificate", socket({}), "no client certificate"],
  ])("refuses %s", (_, given, reason) => {
    expect(identifyPeerCertificate(given)).toEqual({ reason });
  });

  it("checks the issuer when one is expected", () => {
    const device = socket({
      subject: { CN: "olympus-api" },
      issuer: { CN: "Device Issuing CA" },
    });
    expect(identifyPeerCertificate(device, "Service Issuing CA")).toEqual({
      reason: 'issuer "Device Issuing CA" is not "Service Issuing CA"',
    });
    expect(
      identifyPeerCertificate(
        socket({
          subject: { CN: "olympus-api" },
          issuer: { CN: "Service Issuing CA" },
        }),
        "Service Issuing CA",
      ),
    ).toEqual({ name: "olympus-api", deployment: undefined });
  });
});
