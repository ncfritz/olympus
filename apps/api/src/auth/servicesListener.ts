import type { INestApplication } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import * as fs from "fs";
import * as https from "https";
import type * as tls from "tls";
import type { AuthConfig } from "../config/configuration";
import { recordAuthDecision } from "./authMetrics";
import type { Listener, RequestWithPrincipal } from "./principal";

const logger = new Logger("ServicesListener");

const secureContext = (services: AuthConfig["services"]) => ({
  cert: fs.readFileSync(services.certificate),
  key: fs.readFileSync(services.key),
  ca: fs.readFileSync(services.ca),
  // One file per list: Node reads only the first list in a file, and a
  // chain is checked against every authority in it (ADR 0018).
  crl: services.revocationLists.map((path) => fs.readFileSync(path)),
  requestCert: true,
  rejectUnauthorized: true,
});

/**
 * The services listener (ADR 0018): the same application over HTTPS,
 * where a client certificate from the Olympus Services chain is required.
 * A connection without one never reaches the application.
 *
 * The revocation lists are reloaded when their files change, without a
 * restart; existing connections keep the context they handshook with.
 */
export const createServicesListener = (
  app: INestApplication,
  services: AuthConfig["services"],
): https.Server => {
  const express = app.getHttpAdapter().getInstance() as (
    request: unknown,
    response: unknown,
  ) => void;

  const server = https.createServer(
    secureContext(services),
    (request, response) => {
      (request as unknown as RequestWithPrincipal).listener =
        "services" satisfies Listener;
      express(request, response);
    },
  );

  /**
   * A refused handshake, said out loud.
   *
   * Without this the only symptom is the caller's "socket hang up": the
   * request never reaches the guard, so nothing is logged and
   * `auth_decisions_total` never moves -- a listener whose whole job is to
   * refuse connections was refusing them invisibly. The reason is OpenSSL's,
   * which names the actual fault (an unknown CA, a revoked certificate, no
   * certificate at all) rather than leaving it to be guessed at.
   */
  server.on("tlsClientError", (error: Error, socket: tls.TLSSocket) => {
    logger.warn(
      `Refused a connection from ${socket.remoteAddress ?? "an unknown address"}: ${error.message}`,
    );
    recordAuthDecision("services", "reject", "handshake");
  });

  for (const path of services.revocationLists) {
    // `persistent: false` so a watcher never holds the process open.
    fs.watch(path, { persistent: false }, () => {
      try {
        server.setSecureContext(secureContext(services));
        logger.log(`Reloaded the revocation lists after ${path} changed`);
      } catch (error) {
        logger.error(
          `Could not reload the revocation lists: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });
  }

  server.listen(services.port, () =>
    logger.log(`Services listener on ${services.port} (client certificates)`),
  );
  return server;
};
