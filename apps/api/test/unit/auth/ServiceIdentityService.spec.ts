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
  certificate: { subject?: { CN?: string; OU?: string } } | undefined,
  headers: Record<string, string> = {},
) =>
  ({
    headers,
    socket:
      certificate === undefined
        ? {}
        : { getPeerCertificate: () => certificate },
  }) as unknown as RequestWithPrincipal;

describe("ServiceIdentityService", () => {
  const identify = (...args: Parameters<typeof request>) =>
    new ServiceIdentityService(auth).identify(request(...args));

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
