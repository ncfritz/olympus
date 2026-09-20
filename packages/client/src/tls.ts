import * as fs from "fs";
import * as https from "https";

/**
 * The certificate a service identifies itself with on the API's mTLS
 * listener (ADR 0018). Paths, read once when the clients are created:
 * a renewed certificate is picked up by a restart.
 */
export interface ClientTlsOptions {
  /** PEM: the service's certificate, from the Olympus Services CA. */
  certificate: string;
  /** PEM: its private key. */
  key: string;
  /** PEM: the chain that signed the API's server certificate. */
  ca?: string;
}

/**
 * A keep-alive HTTPS agent presenting the service's certificate. Keep-alive
 * is what makes mTLS cheap: one handshake, then every request reuses it.
 */
export const createTlsAgent = (tls: ClientTlsOptions): https.Agent =>
  new https.Agent({
    keepAlive: true,
    cert: fs.readFileSync(tls.certificate),
    key: fs.readFileSync(tls.key),
    ca: tls.ca ? fs.readFileSync(tls.ca) : undefined,
  });

/**
 * `axios` options for createOlympusClients: the agent, or nothing when the
 * service has no certificate (an http:// base URL, until phase 8).
 */
export const tlsAxiosOptions = (
  tls: ClientTlsOptions | undefined,
): { httpsAgent?: https.Agent } =>
  tls === undefined ? {} : { httpsAgent: createTlsAgent(tls) };
