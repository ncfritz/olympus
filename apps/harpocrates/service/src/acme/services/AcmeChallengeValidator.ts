import { Inject, Injectable } from "@nestjs/common";
import * as x509 from "@peculiar/x509";
import { createHash } from "crypto";
import type { LookupFunction } from "net";
import * as http from "http";
import * as https from "https";
import * as tls from "tls";
import { acmeConfig, type AcmeConfigType } from "../../config/configuration";

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 10;
const MAX_BODY = 64 * 1024;

/** id-pe-acmeIdentifier (RFC 8737 §6.1). */
const ACME_IDENTIFIER_OID = "1.3.6.1.5.5.7.1.31";
const ACME_TLS_ALPN = "acme-tls/1";

export type ChallengeKind = "http-01" | "tls-alpn-01";

/** What a validation found: valid, or the ACME error it failed with. */
export type Validation =
  { valid: true } | { valid: false; type: string; detail: string };

const failed = (type: string, detail: string): Validation => ({
  valid: false,
  type,
  detail,
});

/** An ACME error type for a network failure. */
const networkFailure = (
  error: NodeJS.ErrnoException,
  where: string,
): Validation =>
  error.code === "ENOTFOUND" || error.code === "EAI_AGAIN"
    ? failed("dns", `${where}: the name does not resolve (${error.code})`)
    : failed("connection", `${where}: ${error.message}`);

/**
 * Challenge validation (ADR 0020, ACME): whether the host that a name
 * resolves to serves the key authorization, over HTTP on port 80 (http-01,
 * RFC 8555 §8.3) or in a TLS handshake on port 443 (tls-alpn-01, RFC 8737).
 * Neither trusts the certificates it meets: the proof is the key
 * authorization, not the transport.
 */
@Injectable()
export class AcmeChallengeValidator {
  constructor(
    @Inject(acmeConfig.KEY) private readonly config: AcmeConfigType,
  ) {}

  validate(
    kind: ChallengeKind,
    name: string,
    token: string,
    keyAuthorization: string,
  ): Promise<Validation> {
    return kind === "http-01"
      ? this.http01(name, token, keyAuthorization)
      : this.tlsAlpn01(name, keyAuthorization);
  }

  /** Every connection goes to ACME_CHALLENGE_RESOLVE when it is set (tests). */
  private get lookup(): LookupFunction | undefined {
    const address = this.config.challengeResolve;
    if (!address) return undefined;
    const family = address.includes(":") ? 6 : 4;
    return ((_host: string, options: { all?: boolean }, callback: never) => {
      const done = callback as (...args: unknown[]) => void;
      if (options?.all) done(null, [{ address, family }]);
      else done(null, address, family);
    }) as unknown as LookupFunction;
  }

  private async http01(
    name: string,
    token: string,
    keyAuthorization: string,
  ): Promise<Validation> {
    const port = this.config.httpPort;
    let url = new URL(
      `http://${name}${port === 80 ? "" : `:${port}`}/.well-known/acme-challenge/${token}`,
    );
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const answer = await this.get(url).catch((error: NodeJS.ErrnoException) =>
        networkFailure(error, url.toString()),
      );
      if ("valid" in answer) return answer;
      if (answer.status >= 300 && answer.status < 400 && answer.location) {
        const next = new URL(answer.location, url);
        const allowedPorts =
          next.protocol === "http:"
            ? [port, 80]
            : next.protocol === "https:"
              ? [this.config.tlsAlpnPort, 443]
              : [];
        const nextPort = Number(
          next.port || (next.protocol === "https:" ? 443 : 80),
        );
        if (!allowedPorts.includes(nextPort)) {
          return failed(
            "connection",
            `${url}: redirected to ${next}, which is not HTTP on 80 or HTTPS on 443`,
          );
        }
        url = next;
        continue;
      }
      if (answer.status !== 200) {
        return failed(
          "incorrectResponse",
          `${url}: answered ${answer.status}, not 200`,
        );
      }
      return answer.body.trim() === keyAuthorization
        ? { valid: true }
        : failed(
            "incorrectResponse",
            `${url}: served something other than the key authorization`,
          );
    }
    return failed("connection", `More than ${MAX_REDIRECTS} redirects`);
  }

  private get(
    url: URL,
  ): Promise<{ status: number; location?: string; body: string }> {
    return new Promise((resolve, reject) => {
      const options = {
        method: "GET",
        lookup: this.lookup,
        timeout: TIMEOUT_MS,
        headers: { "user-agent": "Harpocrates ACME validation" },
        // https after a redirect: what is served there is checked, not
        // the certificate it is served with.
        rejectUnauthorized: false,
        servername: url.hostname,
      };
      const req = (url.protocol === "https:" ? https : http).request(
        url,
        options,
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => {
            body += chunk;
            if (body.length > MAX_BODY)
              req.destroy(new Error("The answer is too long"));
          });
          response.on("end", () =>
            resolve({
              status: response.statusCode ?? 0,
              location: response.headers.location,
              body,
            }),
          );
        },
      );
      req.on("timeout", () =>
        req.destroy(new Error(`No answer within ${TIMEOUT_MS / 1000} seconds`)),
      );
      req.on("error", reject);
      req.end();
    });
  }

  private tlsAlpn01(
    name: string,
    keyAuthorization: string,
  ): Promise<Validation> {
    const where = `${name}:${this.config.tlsAlpnPort}`;
    const expected = createHash("sha256").update(keyAuthorization).digest();
    return new Promise((resolve) => {
      const socket = tls.connect({
        host: name,
        port: this.config.tlsAlpnPort,
        servername: name,
        ALPNProtocols: [ACME_TLS_ALPN],
        rejectUnauthorized: false,
        timeout: TIMEOUT_MS,
        lookup: this.lookup,
      });
      const done = (validation: Validation) => {
        socket.destroy();
        resolve(validation);
      };
      socket.once("timeout", () =>
        done(
          failed(
            "connection",
            `${where}: no handshake within ${TIMEOUT_MS / 1000} seconds`,
          ),
        ),
      );
      socket.once("error", (error: NodeJS.ErrnoException) =>
        done(
          error.code && /^E[A-Z]+$/.test(error.code)
            ? networkFailure(error, where)
            : failed("tls", `${where}: ${error.message}`),
        ),
      );
      socket.once("secureConnect", () => {
        if (socket.alpnProtocol !== ACME_TLS_ALPN) {
          done(failed("tls", `${where}: did not negotiate ${ACME_TLS_ALPN}`));
          return;
        }
        const raw = socket.getPeerCertificate().raw;
        done(
          raw
            ? this.checkAlpnCertificate(raw, name, expected, where)
            : failed("tls", `${where}: no certificate`),
        );
      });
    });
  }

  /** RFC 8737 §3: one DNS name, the identifier's, and the critical digest. */
  private checkAlpnCertificate(
    der: Buffer,
    name: string,
    expected: Buffer,
    where: string,
  ): Validation {
    let certificate: x509.X509Certificate;
    try {
      certificate = new x509.X509Certificate(new Uint8Array(der));
    } catch {
      return failed("tls", `${where}: the certificate does not parse`);
    }
    const san = certificate.getExtension(x509.SubjectAlternativeNameExtension);
    const names = san?.names.items ?? [];
    if (
      names.length !== 1 ||
      names[0].type !== "dns" ||
      names[0].value.toLowerCase() !== name
    ) {
      return failed(
        "incorrectResponse",
        `${where}: the certificate must name ${name} and nothing else`,
      );
    }
    const extension = certificate.extensions.find(
      (e) => e.type === ACME_IDENTIFIER_OID,
    );
    if (!extension?.critical) {
      return failed(
        "incorrectResponse",
        `${where}: the certificate has no critical acmeIdentifier extension`,
      );
    }
    // extnValue holds an OCTET STRING of the 32-byte digest.
    const value = Buffer.from(extension.value);
    const digest =
      value.length === 34 && value[0] === 0x04 && value[1] === 0x20
        ? value.subarray(2)
        : undefined;
    return digest?.equals(expected)
      ? { valid: true }
      : failed(
          "incorrectResponse",
          `${where}: the acmeIdentifier is not the key authorization's digest`,
        );
  }
}
