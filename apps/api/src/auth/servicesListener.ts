import type { INestApplication } from "@nestjs/common";
import { createClientCertificateListener } from "@ncfritz/olympus-nest";
import type * as https from "https";
import type { AuthConfig } from "../config/configuration";
import { recordAuthDecision } from "./authMetrics";
import type { Listener, RequestWithPrincipal } from "./principal";

/**
 * The services listener (ADR 0018): the same application over HTTPS,
 * where a client certificate from the Olympus Services chain is required.
 * A connection without one never reaches the application. Built on the
 * shared listener; this marks its requests as the services listener's and
 * counts refused handshakes in auth_decisions_total. `pollMs` is how
 * often the revocation lists are checked for a change (tests shorten it).
 */
export const createServicesListener = (
  app: INestApplication,
  services: AuthConfig["services"],
  pollMs?: number,
): https.Server =>
  createClientCertificateListener(app, services, {
    name: "ServicesListener",
    onRequest: (request) => {
      (request as RequestWithPrincipal).listener =
        "services" satisfies Listener;
    },
    onRefused: () => recordAuthDecision("services", "reject", "handshake"),
    pollMs,
  });
