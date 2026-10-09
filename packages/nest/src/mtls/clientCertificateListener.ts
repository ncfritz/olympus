import type { INestApplication } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import * as fs from "fs";
import * as https from "https";
import type * as net from "net";
import type * as tls from "tls";
import {
  revocationCoverage,
  type RevocationSettings,
  revocationWarnings,
} from "./revocation";

/** Paths, and the port. */
export type ClientCertificateListenerConfig = {
  port: number;
  /** PEM: the listener's own certificate. */
  certificate: string;
  key: string;
  /** PEM: the authorities a client certificate may chain to. */
  ca: string;
  /** One file per revocation list: Node reads only the first list in a file. */
  revocationLists: string[];
};

export type ClientCertificateListenerHooks = {
  /** The logger's context, e.g. "ServicesListener". */
  name: string;
  /** Called with every request, before the application sees it. */
  onRequest?: (request: unknown) => void;
  /** Called for every handshake refused. */
  onRefused?: () => void;
  /** The variables the settings came from, for the startup warnings. */
  settings?: RevocationSettings;
  /** How often the revocation lists' files are checked for a change. */
  pollMs?: number;
};

/** How often the revocation lists' files are checked, by default. */
export const REVOCATION_LIST_POLL_MS = 5_000;

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

/**
 * Alerts a caller sends when it refuses *this listener's* certificate,
 * rather than the other way round: the fault is in what the caller trusts
 * or the name it dialled, and it is the caller's own log that says which.
 */
const CALLER_REFUSED =
  /alert (certificate unknown|unknown ca|bad certificate|unsupported certificate|certificate expired|certificate revoked)/;

/**
 * The line a refused handshake is logged with: who, and why. The address
 * is the TCP connection's, captured when it arrived, because by the time
 * the handshake is reported the TLS socket is torn down and has none.
 */
export const refusalMessage = (
  error: Error,
  peer: string | undefined,
): string => {
  const hint = CALLER_REFUSED.test(error.message)
    ? " -- the caller refused this listener's certificate: check the CA file it verifies it with, and that the certificate's SAN has the name it dialled"
    : "";
  return `Refused a connection from ${peer ?? "an unknown address"}: ${error.message}${hint}`;
};

const secureContext = (config: ClientCertificateListenerConfig) => ({
  cert: fs.readFileSync(config.certificate),
  key: fs.readFileSync(config.key),
  ca: fs.readFileSync(config.ca),
  // One file per list: Node reads only the first list in a file, and a
  // chain is checked against every authority in it (ADR 0018).
  crl: config.revocationLists.map(readRevocationList),
  requestCert: true,
  rejectUnauthorized: true,
});

/**
 * The application over HTTPS, where a client certificate from the given
 * chain is required (ADR 0018): a connection without one never reaches the
 * application. Who the certificate names is for the application to check
 * (identifyPeerCertificate).
 *
 * The revocation lists are reloaded when their files change, without a
 * restart; existing connections keep the context they handshook with.
 * The files are polled rather than watched: Harpocrates replaces a list
 * by renaming a new file over it, which a watch on the old file misses.
 */
export const createClientCertificateListener = (
  app: INestApplication,
  config: ClientCertificateListenerConfig,
  hooks: ClientCertificateListenerHooks,
): https.Server => {
  const logger = new Logger(hooks.name);
  const express = app.getHttpAdapter().getInstance() as (
    request: unknown,
    response: unknown,
  ) => void;

  const server = https.createServer(
    secureContext(config),
    (request, response) => {
      hooks.onRequest?.(request);
      express(request, response);
    },
  );

  // Checked once, at startup, because the handshake failure it prevents is
  // silent at both ends (see revocation.ts).
  const coverage = revocationCoverage(
    fs.readFileSync(config.ca, "utf8"),
    config.revocationLists.map((path) =>
      readRevocationList(path).toString("utf8"),
    ),
  );
  logger.log(
    `${coverage.authorities} client authorities, ${coverage.lists} revocation lists`,
  );
  for (const warning of revocationWarnings(coverage, hooks.settings)) {
    logger.warn(warning);
  }

  /**
   * A refused handshake, said out loud.
   *
   * Without this the only symptom is the caller's "socket hang up": the
   * request never reaches the application, so nothing is logged -- a
   * listener whose whole job is to refuse connections would refuse them
   * invisibly. The reason is OpenSSL's, which names the actual fault (an
   * unknown CA, a revoked certificate, no certificate at all) -- except where
   * TLS 1.3 leaves it nothing to report but a reset, which is what a chain
   * rejected for want of a revocation list looks like. The startup check
   * above is for that one.
   */
  // Where each connection came from, kept from when it arrived (above).
  const peers = new WeakMap<net.Socket, string>();
  server.on("connection", (socket: net.Socket) => {
    if (socket.remoteAddress) {
      peers.set(socket, `${socket.remoteAddress}:${socket.remotePort}`);
    }
  });
  server.on("tlsClientError", (error: Error, socket: tls.TLSSocket) => {
    // Node's TLS socket wraps the TCP one as `_parent`; it is not typed.
    const tcp = (socket as tls.TLSSocket & { _parent?: net.Socket })._parent;
    const peer =
      (tcp && peers.get(tcp)) ??
      (socket.remoteAddress
        ? `${socket.remoteAddress}:${socket.remotePort}`
        : undefined);
    logger.warn(refusalMessage(error, peer));
    hooks.onRefused?.();
  });

  const pollMs = hooks.pollMs ?? REVOCATION_LIST_POLL_MS;
  for (const path of config.revocationLists) {
    const changed = (current: fs.Stats, previous: fs.Stats) => {
      if (
        current.mtimeMs === previous.mtimeMs &&
        current.ino === previous.ino &&
        current.size === previous.size
      ) {
        return;
      }
      try {
        server.setSecureContext(secureContext(config));
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

  server.listen(config.port, () =>
    logger.log(`Listening on ${config.port} (client certificates)`),
  );
  return server;
};
