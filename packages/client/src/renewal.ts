// @peculiar/x509 resolves its parts through tsyringe, which needs the
// Reflect polyfill: loaded here so a service without Nest can renew too.
import "reflect-metadata";
import { webcrypto, X509Certificate } from "crypto";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import * as x509 from "@peculiar/x509";
import type { ClientTlsOptions, CertificateRenewalTarget } from "./tls";

/** What a check did. */
export type RenewalOutcome = "not-due" | "renewed" | "rekeyed" | "failed";

/** Where a renewer says what it did; Nest's Logger fits. */
export interface RenewalLogger {
  log(message: string): void;
  warn(message: string): void;
}

/** How often a renewer checks, by default: hourly. */
export const RENEWAL_CHECK_MS = 60 * 60 * 1000;

/** When a certificate is renewed: two-thirds of the way through its life (ADR 0020). */
export const renewalDue = (notBefore: Date, notAfter: Date): Date =>
  new Date(
    notBefore.getTime() + ((notAfter.getTime() - notBefore.getTime()) * 2) / 3,
  );

const ALGORITHM = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };

const firstCertificate = (pem: string): string => {
  const match =
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/.exec(pem);
  if (!match) throw new Error("no certificate in the file");
  return `${match[0]}\n`;
};

/** Writes a file whole or not at all: aside, then renamed over. */
const replace = (file: string, data: string, mode: number) => {
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.tmp`,
  );
  fs.writeFileSync(temporary, data, { mode });
  fs.renameSync(temporary, file);
};

type Answer = { status: number; body: Record<string, unknown> };

/**
 * A service's certificate, renewing itself (ADR 0020, Renewal and
 * delivery): at two-thirds of its life it presents itself to Harpocrates's
 * renewal listener and writes the renewal over its own files, which the
 * ReloadingTlsAgent then picks up. It keeps its key while the profile
 * allows, and makes a new one, with a CSR, when Harpocrates says the key
 * is too old. A failure is logged and tried again at the next check: the
 * certificate it has goes on working until it expires.
 */
export class CertificateRenewer {
  private timer?: NodeJS.Timeout;
  private running?: Promise<RenewalOutcome>;

  constructor(
    private readonly tls: ClientTlsOptions & {
      renewal: CertificateRenewalTarget;
    },
    private readonly logger: RenewalLogger = console,
  ) {}

  /** Checks now and every `intervalMs` after. */
  start(intervalMs: number = RENEWAL_CHECK_MS): void {
    this.timer = setInterval(() => void this.check(), intervalMs);
    this.timer.unref();
    void this.check();
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  /** Nest's lifecycle, when a module provides it. */
  async onApplicationShutdown(): Promise<void> {
    await this.stop();
  }

  /** When the current certificate is due. */
  due(): Date {
    const cert = new X509Certificate(
      firstCertificate(fs.readFileSync(this.tls.certificate, "utf8")),
    );
    return renewalDue(new Date(cert.validFrom), new Date(cert.validTo));
  }

  /** Renews if it is due; one at a time. */
  check(now: Date = new Date()): Promise<RenewalOutcome> {
    this.running ??= this.run(now).finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async run(now: Date): Promise<RenewalOutcome> {
    try {
      const due = this.due();
      if (now < due) return "not-due";
      const kept = await this.renew({});
      if (kept.status === 201) {
        this.install(kept.body);
        this.logger.log(`Renewed ${this.tls.certificate}, keeping its key`);
        return "renewed";
      }
      if (kept.status === 422 && /older than/.test(String(kept.body.message))) {
        return await this.rekey();
      }
      this.logger.warn(
        `Renewing ${this.tls.certificate} was refused (${kept.status}): ${String(kept.body.message ?? "")}`,
      );
      return "failed";
    } catch (error) {
      this.logger.warn(
        `Renewing ${this.tls.certificate} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return "failed";
    }
  }

  /** A new key, its CSR for the same subject and names, and the renewal. */
  private async rekey(): Promise<RenewalOutcome> {
    const current = new x509.X509Certificate(
      firstCertificate(fs.readFileSync(this.tls.certificate, "utf8")),
    );
    const pair = (await webcrypto.subtle.generateKey(ALGORITHM, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const san = current.getExtension(x509.SubjectAlternativeNameExtension);
    const csr = await x509.Pkcs10CertificateRequestGenerator.create({
      name: current.subjectName,
      keys: pair,
      signingAlgorithm: ALGORITHM,
      extensions: san ? [san] : [],
    });
    const answer = await this.renew({ csr: csr.toString("pem") });
    if (answer.status !== 201) {
      this.logger.warn(
        `Rekeying ${this.tls.certificate} was refused (${answer.status}): ${String(answer.body.message ?? "")}`,
      );
      return "failed";
    }
    const pkcs8 = await webcrypto.subtle.exportKey("pkcs8", pair.privateKey);
    // The key first: until the certificate follows, the pair does not
    // match and the agent keeps the old one.
    replace(
      this.tls.key,
      x509.PemConverter.encode(pkcs8, "PRIVATE KEY"),
      0o600,
    );
    this.install(answer.body);
    this.logger.log(`Renewed ${this.tls.certificate} with a new key`);
    return "rekeyed";
  }

  private install(body: Record<string, unknown>): void {
    const renewal = body.certificate as {
      certificate: string;
      chain: string[];
    };
    replace(
      this.tls.certificate,
      [renewal.certificate, ...renewal.chain].join(""),
      0o644,
    );
  }

  /** POST /v1/renew, presenting the current certificate. */
  private renew(body: { csr?: string }): Promise<Answer> {
    const url = new URL("/v1/renew", this.tls.renewal.url);
    const payload = JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const request = https.request(
        url,
        {
          method: "POST",
          cert: fs.readFileSync(this.tls.certificate),
          key: fs.readFileSync(this.tls.key),
          ca: this.tls.renewal.ca
            ? fs.readFileSync(this.tls.renewal.ca)
            : undefined,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
          },
          timeout: 30_000,
        },
        (response) => {
          let text = "";
          response.on("data", (chunk: Buffer) => (text += chunk.toString()));
          response.on("end", () => {
            let parsed: Record<string, unknown>;
            try {
              parsed = text
                ? (JSON.parse(text) as Record<string, unknown>)
                : {};
            } catch {
              parsed = { message: text };
            }
            resolve({ status: response.statusCode ?? 0, body: parsed });
          });
        },
      );
      request.on("timeout", () => request.destroy(new Error("timed out")));
      request.on("error", reject);
      request.end(payload);
    });
  }
}
