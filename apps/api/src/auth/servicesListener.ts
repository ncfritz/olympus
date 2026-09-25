import type { INestApplication } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import * as fs from "fs";
import * as https from "https";
import type { AuthConfig } from "../config/configuration";
import type { Listener, RequestWithPrincipal } from "./principal";

const logger = new Logger("ServicesListener");

/** How often the revocation lists' files are checked for a change. */
const REVOCATION_LIST_POLL_MS = 5_000;

/**
 * A revocation list as Node takes it, PEM. Harpocrates publishes DER, as
 * CRL distribution points serve it (ADR 0020); older files are PEM.
 */
export const readRevocationList = (path: string): Buffer => {
  const data = fs.readFileSync(path);
  if (data.subarray(0, 64).toString("latin1").includes("-----BEGIN")) {
    return data;
  }
  const lines = data.toString("base64").match(/.{1,64}/g) ?? [];
  return Buffer.from(
    `-----BEGIN X509 CRL-----\n${lines.join("\n")}\n-----END X509 CRL-----\n`,
  );
};

const secureContext = (services: AuthConfig["services"]) => ({
  cert: fs.readFileSync(services.certificate),
  key: fs.readFileSync(services.key),
  ca: fs.readFileSync(services.ca),
  // One file per list: Node reads only the first list in a file, and a
  // chain is checked against every authority in it (ADR 0018).
  crl: services.revocationLists.map(readRevocationList),
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
 * The files are polled rather than watched: Harpocrates replaces a list
 * by renaming a new file over it, which a watch on the old file misses.
 */
export const createServicesListener = (
  app: INestApplication,
  services: AuthConfig["services"],
  pollMs = REVOCATION_LIST_POLL_MS,
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

  for (const path of services.revocationLists) {
    const changed = (current: fs.Stats, previous: fs.Stats) => {
      if (
        current.mtimeMs === previous.mtimeMs &&
        current.ino === previous.ino &&
        current.size === previous.size
      ) {
        return;
      }
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
    };
    // `persistent: false` so polling never holds the process open.
    fs.watchFile(path, { persistent: false, interval: pollMs }, changed);
    server.on("close", () => fs.unwatchFile(path, changed));
  }

  server.listen(services.port, () =>
    logger.log(`Services listener on ${services.port} (client certificates)`),
  );
  return server;
};
