import { describe, expect, it } from "vitest";
import type { RequestWithPrincipal } from "../../../src/auth/principal";
import { ServiceIdentityService } from "../../../src/auth/services/ServiceIdentityService";
import type { AuthConfigType } from "../../../src/config/configuration";

const auth = {
  modes: { users: "report", services: "report" },
  serviceRoles: { "dionysus-asset-agent": ["agent", "content"] },
  services: {
    enabled: false,
    port: 3443,
    certificate: "",
    key: "",
    ca: "",
    revocationLists: [],
  },
} as AuthConfigType;

const request = (
  certificate:
    | { subject?: { CN?: string; OU?: string }; issuer?: { CN?: string } }
    | undefined,
  headers: Record<string, string> = {},
) =>
  ({
    headers,
    socket:
      certificate === undefined
        ? {}
        : { getPeerCertificate: () => certificate },
  }) as unknown as RequestWithPrincipal;

// The same configuration, naming the authority that may sign (ADR 0023).
const withIssuer = {
  ...auth,
  servicesIssuer: "ncfritz.net Service Issuing CA 1 - G1",
} as AuthConfigType;

describe("ServiceIdentityService", () => {
  const identify = (...args: Parameters<typeof request>) =>
    new ServiceIdentityService(auth).identify(request(...args));
  const identifyChecked = (...args: Parameters<typeof request>) =>
    new ServiceIdentityService(withIssuer).identify(request(...args));

  it("reads the service and its deployment from the certificate", () => {
    expect(
      identify({ subject: { CN: "dionysus-asset-agent", OU: "nas" } }),
    ).toEqual({
      principal: {
        kind: "service",
        name: "dionysus-asset-agent",
        deployment: "nas",
        roles: ["agent", "content"],
      },
    });
  });

  it("refuses a connection that is not TLS", () => {
    expect(identify(undefined)).toEqual({ reason: "not a TLS connection" });
  });

  it("refuses a TLS connection that presented no certificate", () => {
    expect(identify({})).toEqual({ reason: "no client certificate" });
  });

  it("refuses a service the configuration does not grant roles", () => {
    expect(identify({ subject: { CN: "olympus-site" } })).toEqual({
      reason: 'unknown service "olympus-site"',
    });
  });

  describe("the issuing authority", () => {
    // A device certificate chains to the same root as a service one — the
    // two issuing CAs are siblings — so the handshake accepting it says
    // nothing about which CA signed it.
    it("refuses a certificate signed by another authority", () => {
      expect(
        identifyChecked({
          subject: { CN: "dionysus-asset-agent", OU: "nas" },
          issuer: { CN: "ncfritz.net Device Issuing CA 1 - G1" },
        }),
      ).toEqual({
        reason:
          'issuer "ncfritz.net Device Issuing CA 1 - G1" is not ' +
          '"ncfritz.net Service Issuing CA 1 - G1"',
      });
    });

    it("refuses a certificate whose issuer it cannot read", () => {
      expect(
        identifyChecked({ subject: { CN: "dionysus-asset-agent" } }),
      ).toEqual({
        reason: 'issuer "none" is not "ncfritz.net Service Issuing CA 1 - G1"',
      });
    });

    it("accepts one signed by the authority it names", () => {
      expect(
        identifyChecked({
          subject: { CN: "dionysus-asset-agent", OU: "nas" },
          issuer: { CN: "ncfritz.net Service Issuing CA 1 - G1" },
        }),
      ).toHaveProperty("principal");
    });

    it("does not check the issuer when none is configured", () => {
      // An environment without certificates is unchanged by this.
      expect(
        identify({
          subject: { CN: "dionysus-asset-agent" },
          issuer: { CN: "whoever" },
        }),
      ).toHaveProperty("principal");
    });

    it("checks the issuer before the roles, so the log says which failed", () => {
      expect(
        identifyChecked({
          subject: { CN: "olympus-site" },
          issuer: { CN: "ncfritz.net Device Issuing CA 1 - G1" },
        }),
      ).toEqual({
        reason:
          'issuer "ncfritz.net Device Issuing CA 1 - G1" is not ' +
          '"ncfritz.net Service Issuing CA 1 - G1"',
      });
    });
  });

  it("refuses a client header that disagrees with the certificate", () => {
    expect(
      identify(
        { subject: { CN: "dionysus-asset-agent" } },
        { "x-olympus-client": "dionysus-search-agent" },
      ),
    ).toEqual({
      reason:
        'client header "dionysus-search-agent" is not "dionysus-asset-agent"',
    });
  });

  it("accepts a client header that agrees with it", () => {
    expect(
      identify(
        { subject: { CN: "dionysus-asset-agent" } },
        { "x-olympus-client": "dionysus-asset-agent" },
      ),
    ).toHaveProperty("principal");
  });
});
