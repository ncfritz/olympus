import { CLIENT_HEADER } from "@ncfritz/olympus-metrics";
import { Inject, Injectable } from "@nestjs/common";
import type { TLSSocket } from "tls";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import type { RequestWithPrincipal, ServicePrincipal } from "../principal";

export type ServiceIdentity =
  { principal: ServicePrincipal } | { reason: string };

/**
 * The principal of a request on the services listener: its client
 * certificate, which the TLS handshake already verified against the
 * Olympus Services chain and its revocation lists (ADR 0018). The common
 * name is the service, the organizational unit its deployment, and the
 * roles come from configuration.
 *
 * The handshake does not establish which authority signed, only that the
 * chain reached a trusted one, so the issuer is checked here as well
 * (ADR 0023).
 */
@Injectable()
export class ServiceIdentityService {
  constructor(@Inject(authConfig.KEY) private readonly auth: AuthConfigType) {}

  identify(request: RequestWithPrincipal): ServiceIdentity {
    const socket = request.socket as TLSSocket;
    if (typeof socket.getPeerCertificate !== "function") {
      return { reason: "not a TLS connection" };
    }
    const certificate = socket.getPeerCertificate();
    const subject = certificate?.subject;
    const name = firstValue(subject?.CN);
    if (!name) {
      // Only reachable when the listener asks for a certificate without
      // requiring one; the handshake refuses the rest.
      return { reason: "no client certificate" };
    }

    // The handshake proved the chain; it did not prove *which* authority
    // signed. The issuing CAs for services and for devices are siblings
    // under one parent, and a trust store has to terminate at a
    // self-signed certificate, so a device certificate builds a valid
    // chain to the same root (ADR 0023). Name the authority we meant.
    const expected = this.auth.servicesIssuer;
    if (expected) {
      const issuer = firstValue(certificate?.issuer?.CN);
      if (issuer !== expected) {
        return {
          reason: `issuer "${issuer ?? "none"}" is not "${expected}"`,
        };
      }
    }

    const roles = this.auth.serviceRoles[name];
    if (roles === undefined) {
      return { reason: `unknown service "${name}"` };
    }

    // The metrics header is the caller's own claim; the certificate is
    // what the API verified. They must agree.
    const claimed = firstValue(request.headers[CLIENT_HEADER]);
    if (claimed && claimed !== name) {
      return { reason: `client header "${claimed}" is not "${name}"` };
    }

    return {
      principal: {
        kind: "service",
        name,
        deployment: firstValue(subject?.OU),
        roles,
      },
    };
  }
}

/** A distinguished name's attribute is multi-valued when it is repeated. */
const firstValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);
