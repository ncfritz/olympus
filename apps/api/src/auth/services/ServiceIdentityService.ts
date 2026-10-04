import { CLIENT_HEADER } from "@ncfritz/olympus-metrics";
import { firstValue, identifyPeerCertificate } from "@ncfritz/olympus-nest";
import { Inject, Injectable } from "@nestjs/common";
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
    // The handshake proved the chain; this names the authority we meant
    // (ADR 0023) and reads the service from the certificate.
    const peer = identifyPeerCertificate(
      request.socket,
      this.auth.servicesIssuer,
    );
    if ("reason" in peer) return peer;
    const { name, deployment } = peer;

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
        deployment,
        roles,
      },
    };
  }
}
