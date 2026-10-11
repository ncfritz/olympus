import { X509Certificate, createPrivateKey } from "crypto";
import * as fs from "fs";
import * as https from "https";

/**
 * The certificate a service identifies itself with on the API's mTLS
 * listener (ADR 0018). Paths: a renewed certificate is picked up from
 * them without a restart (ADR 0020, Renewal and delivery).
 */
export interface ClientTlsOptions {
  /** PEM: the service's certificate (and its chain), from the Olympus Services CA. */
  certificate: string;
  /** PEM: its private key. */
  key: string;
  /** PEM: the chain that signed the API's server certificate. */
  ca?: string;
  /**
   * Where the certificate renews itself (Harpocrates's renewal listener,
   * ADR 0020), when it does: the files above are replaced in place.
   */
  renewal?: CertificateRenewalTarget;
}

/** Harpocrates's renewal listener, as a service reaches it. */
export interface CertificateRenewalTarget {
  /** Its base URL: https://pki.internal.ncfritz.net:9443 */
  url: string;
  /** PEM: the chain that signed the listener's certificate (the TLS CA's). */
  ca?: string;
}

/** How often the files are checked for a renewal, by default. */
export const TLS_RELOAD_POLL_MS = 5_000;

type Identity = { cert: Buffer; key: Buffer };

/** The certificate and key, when they are a pair; undefined mid-renewal. */
const readIdentity = (tls: ClientTlsOptions): Identity | undefined => {
  const cert = fs.readFileSync(tls.certificate);
  const key = fs.readFileSync(tls.key);
  try {
    const matches = new X509Certificate(cert).checkPrivateKey(
      createPrivateKey(key),
    );
    return matches ? { cert, key } : undefined;
  } catch {
    return undefined;
  }
};

/**
 * A keep-alive HTTPS agent presenting the service's certificate, which it
 * reloads when the files change: a renewal (the renewer, or a person
 * replacing them) takes effect on the next connection, with no restart.
 * Connections already open finish with the certificate they handshook
 * with; idle ones are closed so the next request opens a new one.
 *
 * A certificate and key that do not match, as for a moment while a
 * renewal writes them, are left until the next check.
 */
export class ReloadingTlsAgent extends https.Agent {
  private readonly files: string[];
  private readonly onChange = () => void this.reload();

  constructor(
    private readonly tls: ClientTlsOptions,
    pollMs: number = TLS_RELOAD_POLL_MS,
  ) {
    const identity = readIdentity(tls);
    if (!identity) {
      throw new Error(
        `${tls.certificate} and ${tls.key} are not a certificate and its key`,
      );
    }
    super({
      keepAlive: true,
      ...identity,
      ca: tls.ca ? fs.readFileSync(tls.ca) : undefined,
    });
    this.files = [tls.certificate, tls.key];
    // `persistent: false` so polling never holds the process open.
    for (const file of this.files) {
      fs.watchFile(
        file,
        { persistent: false, interval: pollMs },
        this.onChange,
      );
    }
  }

  /** Reloads the certificate and key if they changed; whether it did. */
  reload(): boolean {
    let identity: Identity | undefined;
    try {
      identity = readIdentity(this.tls);
    } catch {
      return false;
    }
    const options = this.options as https.AgentOptions;
    if (
      !identity ||
      (Buffer.from(options.cert as Buffer).equals(identity.cert) &&
        Buffer.from(options.key as Buffer).equals(identity.key))
    ) {
      return false;
    }
    // The options every new connection is made with.
    options.cert = identity.cert;
    options.key = identity.key;
    for (const sockets of Object.values(this.freeSockets)) {
      for (const socket of sockets ?? []) socket.destroy();
    }
    return true;
  }

  override destroy(): void {
    for (const file of this.files) fs.unwatchFile(file, this.onChange);
    super.destroy();
  }
}

/**
 * A keep-alive HTTPS agent presenting the service's certificate. Keep-alive
 * is what makes mTLS cheap: one handshake, then every request reuses it.
 */
export const createTlsAgent = (
  tls: ClientTlsOptions,
  pollMs?: number,
): ReloadingTlsAgent => new ReloadingTlsAgent(tls, pollMs);

/**
 * `axios` options for createOlympusClients: the agent, or nothing when the
 * service has no certificate (an http:// base URL, until phase 8).
 */
export const tlsAxiosOptions = (
  tls: ClientTlsOptions | undefined,
): { httpsAgent?: https.Agent } =>
  tls === undefined ? {} : { httpsAgent: createTlsAgent(tls) };
