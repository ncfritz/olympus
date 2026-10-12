import { Injectable } from "@nestjs/common";
import { isIP } from "net";
import * as tls from "tls";

const TIMEOUT_MS = 10_000;

/**
 * What a TLS handshake with an endpoint showed: the certificate it
 * served, and whether it stapled an OCSP response.
 */
export type Probe = { der: Buffer; stapled: boolean } | { error: string };

/** host:port, split; a bracketed IPv6 host is unbracketed. */
export const splitEndpoint = (
  endpoint: string,
): { host: string; port: number } => {
  const at = endpoint.lastIndexOf(":");
  return {
    host: endpoint.slice(0, at).replace(/^\[(.*)\]$/, "$1"),
    port: Number(endpoint.slice(at + 1)),
  };
};

/**
 * Asks an endpoint for its certificate: a TLS handshake that sends the
 * host as SNI, asks for a stapled OCSP response, and trusts anything,
 * because the question is what it serves, not whether that is any good.
 * Nothing is sent after it.
 */
@Injectable()
export class EndpointProbe {
  probe(endpoint: string): Promise<Probe> {
    const { host, port } = splitEndpoint(endpoint);
    return new Promise((resolve) => {
      const socket = tls.connect({
        host,
        port,
        servername: isIP(host) ? undefined : host,
        rejectUnauthorized: false,
        requestOCSP: true,
        timeout: TIMEOUT_MS,
      });
      // Emitted before secureConnect: null when nothing was stapled.
      let stapled = false;
      socket.once("OCSPResponse", (response: Buffer | null) => {
        stapled = Boolean(response?.length);
      });
      const done = (answer: Probe) => {
        socket.destroy();
        resolve(answer);
      };
      socket.once("secureConnect", () => {
        const raw = socket.getPeerCertificate().raw;
        done(
          raw
            ? { der: raw, stapled }
            : { error: "It presented no certificate" },
        );
      });
      socket.once("timeout", () =>
        done({ error: `No handshake within ${TIMEOUT_MS / 1000} seconds` }),
      );
      socket.once("error", (error: Error) => done({ error: error.message }));
    });
  }
}
