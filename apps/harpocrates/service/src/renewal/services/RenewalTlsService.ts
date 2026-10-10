import { Inject, Injectable, Logger } from "@nestjs/common";
import * as x509 from "@peculiar/x509";
import { webcrypto, X509Certificate } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import {
  renewalConfig,
  type RenewalConfigType,
} from "../../config/configuration";
import { SYSTEM } from "../../auth/principal";
import { CertificateService } from "../../certificates/services/CertificateService";
import type { FullCertificate } from "../../model/certificates";

/** What the listener serves: its key, and its certificate with the chain. */
export type ListenerIdentity = { key: string; cert: string; notAfter: Date };

const FILES = {
  key: "key.pem",
  cert: "cert.pem",
  id: "certificate-id",
} as const;

const ALGORITHM = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };

/** When a certificate is renewed: two-thirds of the way through its life. */
export const renewalDue = (notBefore: Date, notAfter: Date): Date =>
  new Date(
    notBefore.getTime() + ((notAfter.getTime() - notBefore.getTime()) * 2) / 3,
  );

/**
 * The renewal listener's own certificate (ADR 0020: ACME and renewal are
 * served with a certificate from the TLS CA). Harpocrates issues it to
 * itself under RENEWAL_TLS_PROFILE for RENEWAL_HOSTNAMES, from a key it
 * makes and keeps in RENEWAL_TLS_DIR: the signer never holds it, as it
 * would not for any server's. It is renewed at two-thirds of its life,
 * keeping the key while the profile allows.
 */
@Injectable()
export class RenewalTlsService {
  private readonly logger = new Logger(RenewalTlsService.name);

  constructor(
    private readonly certificates: CertificateService,
    @Inject(renewalConfig.KEY) private readonly config: RenewalConfigType,
  ) {}

  /**
   * The identity to serve, issued or renewed first when it is missing or
   * due. @throws when it cannot be had: no TLS issuing CA yet, the signer
   * sealed, a name the profile or the CA refuses.
   */
  async current(now = new Date()): Promise<ListenerIdentity> {
    const stored = await this.read();
    if (stored) {
      const cert = new X509Certificate(stored.cert);
      const notBefore = new Date(cert.validFrom);
      const notAfter = new Date(cert.validTo);
      if (now < renewalDue(notBefore, notAfter)) {
        return { key: stored.key, cert: stored.cert, notAfter };
      }
      try {
        return await this.save(
          stored.key,
          await this.certificates.renew(SYSTEM, stored.id, {}),
        );
      } catch (error) {
        this.logger.warn(
          `Could not renew the listener's certificate (${String(error)}); issuing a new one`,
        );
      }
    }
    return this.issue();
  }

  /** A new key, and a certificate for it. */
  private async issue(): Promise<ListenerIdentity> {
    const pair = (await webcrypto.subtle.generateKey(ALGORITHM, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const [commonName] = this.config.hostnames;
    const csr = await x509.Pkcs10CertificateRequestGenerator.create({
      name: `CN=${commonName}`,
      keys: pair,
      signingAlgorithm: ALGORITHM,
      extensions: [
        new x509.SubjectAlternativeNameExtension(
          this.config.hostnames.map((value) => ({
            type: "dns" as const,
            value,
          })),
        ),
      ],
    });
    const certificate = await this.certificates.create(SYSTEM, {
      profileId: this.config.profileId,
      subject: { commonName },
      names: { dns: this.config.hostnames },
      csr: csr.toString("pem"),
    });
    const pkcs8 = await webcrypto.subtle.exportKey("pkcs8", pair.privateKey);
    const key = x509.PemConverter.encode(pkcs8, "PRIVATE KEY");
    this.logger.log(
      `Issued the renewal listener's certificate ${certificate.serial} for ${this.config.hostnames.join(", ")}`,
    );
    return this.save(key, certificate);
  }

  private async save(
    key: string,
    certificate: FullCertificate,
  ): Promise<ListenerIdentity> {
    const dir = this.config.tlsDir;
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const cert = [certificate.certificate, ...certificate.chain].join("");
    // Each file whole or not at all: written aside, then renamed over.
    const write = async (name: string, data: string) => {
      const temporary = path.join(dir, `${name}.${process.pid}.tmp`);
      await fs.writeFile(temporary, data, { mode: 0o600 });
      await fs.rename(temporary, path.join(dir, name));
    };
    await write(FILES.key, key);
    await write(FILES.cert, cert);
    await write(FILES.id, certificate.id);
    return { key, cert, notAfter: certificate.notAfter.toDate() };
  }

  private async read(): Promise<
    { key: string; cert: string; id: string } | undefined
  > {
    const dir = this.config.tlsDir;
    try {
      const [key, cert, id] = await Promise.all([
        fs.readFile(path.join(dir, FILES.key), "utf8"),
        fs.readFile(path.join(dir, FILES.cert), "utf8"),
        fs.readFile(path.join(dir, FILES.id), "utf8"),
      ]);
      return { key, cert, id: id.trim() };
    } catch {
      return undefined;
    }
  }
}
