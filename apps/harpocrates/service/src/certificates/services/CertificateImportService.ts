import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Issuer as IssuerRow, Key as KeyRow } from "../../store/prisma";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import type { Principal } from "../../auth/principal";
import { KeyService } from "../../keys/services/KeyService";
import type {
  AddCertificateCsrRequest,
  AddCertificateKeyRequest,
  Certificate,
  ImportCertificatesRequest,
  ImportCertificatesResponse,
  ImportedKey,
  SkippedCertificate,
} from "../../model/certificates";
import { ProfileService } from "../../profiles/services/ProfileService";
import {
  bytes,
  certificateNames,
  certificatePem,
  isIssuedBy,
  parseCertificate,
  parseCsr,
  type ParsedCertificate,
  spkiFromPem,
  splitCertificates,
} from "../../pki/x509";
import { SignerService } from "../../signer/services/SignerService";
import { PrismaService } from "../../store/PrismaService";
import {
  CERTIFICATE_LINEAGE,
  toDomainObject,
} from "../converters/CertificateConverter";

/**
 * Certificates another CA product issued (XCA's, at the cutover; ADR 0020):
 * each recorded under the CA here that signed it, with its serial, dates
 * and key, as issued under the profile the operator names. A key is
 * recorded once and a certificate once; importing again adds only what is
 * new. Revocations come afterwards, from the CAs' last lists
 * (CrlService.import), which revoke the certificates they name.
 *
 * With a key (ADR 0039), the certificate it belongs to comes with it: the
 * key escrowed in the signer, and its CSR, if given, kept on its
 * enrollment. A certificate already imported gains them.
 */
/** A key brought with the certificates, and the signer's ID once kept. */
type Brought = { key: ImportedKey; spki: Buffer; signerKeyId?: string };

@Injectable()
export class CertificateImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileService,
    private readonly keys: KeyService,
    private readonly signer: SignerService,
    private readonly audit: AuditService,
  ) {}

  async import(
    principal: Principal,
    request: ImportCertificatesRequest,
  ): Promise<ImportCertificatesResponse> {
    if (request.csr && !request.key) {
      throw new UnprocessableEntityException("A CSR comes with its key");
    }
    const profile = await this.profiles.row(request.profileId);
    if (request.key && !profile.allowGenerated) {
      throw new UnprocessableEntityException(
        `The ${profile.id} profile takes a CSR: its keys are the subscriber's`,
      );
    }
    const csr = request.csr ? await this.csrOf(request.csr) : undefined;
    const pems = request.certificates.flatMap((item) =>
      splitCertificates(item),
    );
    // Read first, kept only once its certificate is sure to take it: a key
    // the signer has held is refused for good after.
    const brought: Brought | undefined = request.key
      ? { key: request.key, spki: await this.publicKeyOf(request.key) }
      : undefined;
    if (brought) {
      if (csr && !csr.spki.equals(brought.spki)) {
        throw new UnprocessableEntityException(
          "The CSR is not the key's: its public key differs",
        );
      }
      if (!pems.some((pem) => this.spkiOf(pem)?.equals(brought.spki))) {
        throw new UnprocessableEntityException(
          "The key is none of these certificates'",
        );
      }
    }

    const issuers = (
      await this.prisma.issuer.findMany({ orderBy: { id: "asc" } })
    ).filter((issuer) => issuer.certificate !== null);
    const importedIds: string[] = [];
    const keyedIds: string[] = [];
    const skipped: SkippedCertificate[] = [];

    for (const pem of pems) {
      let parsed: ParsedCertificate;
      try {
        parsed = parseCertificate(pem);
      } catch {
        skipped.push({ reason: "Not a certificate" });
        continue;
      }
      // The certificate the brought key is for, if this is it.
      const takesKey =
        brought !== undefined && parsed.spki.equals(brought.spki);
      const skip = (reason: string) =>
        skipped.push({
          subject: parsed.subject,
          serial: parsed.serial,
          reason: takesKey ? `${reason}; its key is not kept` : reason,
        });
      if (parsed.ca) {
        skip("A CA: import it as an issuer");
        continue;
      }
      const issuer = this.issuerOf(pem, parsed, issuers);
      if (!issuer) {
        skip(`Signed by ${parsed.issuer}, which is not a CA here`);
        continue;
      }
      if (request.issuerId && issuer.id !== request.issuerId) {
        skip(`Signed by ${issuer.id}, not ${request.issuerId}`);
        continue;
      }
      const key = await this.keys.findBySpki(parsed.spki);
      if (key?.purpose === "issuer") {
        skip("Its key is a CA's");
        continue;
      }
      const existing = await this.prisma.certificate.findUnique({
        where: {
          issuerId_serial: { issuerId: issuer.id, serial: parsed.serial },
        },
      });
      if (existing) {
        // Kept already, for another of its certificates in this import.
        const keptHere =
          key?.signerKeyId != null && key.signerKeyId === brought?.signerKeyId;
        if (!takesKey || !key || !existing.enrollmentId || keptHere) {
          skipped.push({
            subject: parsed.subject,
            serial: parsed.serial,
            reason: "Already imported",
          });
          continue;
        }
        const enrollmentId = existing.enrollmentId;
        const problem = await this.keyProblem(key, enrollmentId);
        if (problem) {
          skip(`Already imported: ${problem}`);
          continue;
        }
        await this.keeping(brought, (signerKeyId) =>
          this.prisma.$transaction((tx) =>
            this.escrow(tx, principal, {
              key,
              signerKeyId,
              enrollmentId,
              certificateId: existing.id,
              csr: csr?.pem,
            }),
          ),
        );
        keyedIds.push(existing.id);
        continue;
      }
      if (takesKey && key?.blockedAt) {
        skip("Its key was revoked for keyCompromise");
        continue;
      }

      const record = (signerKeyId?: string) =>
        this.prisma.$transaction(async (tx) => {
          const subjectKey =
            key ??
            (await this.keys.record(tx, {
              spki: parsed.spki,
              purpose: "subject",
              location: "subscriber",
            }));
          // A key XCA certified more than once (a renewal keeping the key)
          // is one enrollment here, as it would have been.
          const enrollment =
            (await tx.enrollment.findUnique({
              where: { keyId: subjectKey.id },
            })) ??
            (await tx.enrollment.create({
              data: {
                keyId: subjectKey.id,
                profileId: profile.id,
                profileVersionId: profile.versionId,
                mode: "imported",
                subject: parsed.subject,
                names: { create: certificateNames(pem) },
              },
            }));
          const created = await tx.certificate.create({
            data: {
              issuerId: issuer.id,
              serial: parsed.serial,
              enrollmentId: enrollment.id,
              profileId: profile.id,
              profileVersionId: profile.versionId,
              subject: parsed.subject,
              notBefore: parsed.notBefore,
              notAfter: parsed.notAfter,
              der: parsed.der,
            },
          });
          await this.audit.record(
            {
              kind: AuditKind.CertificateImported,
              principal,
              subjectType: "certificate",
              subjectId: created.id,
              attributes: {
                issuerId: issuer.id,
                serial: parsed.serial,
                profileId: profile.id,
                subject: parsed.subject,
                notAfter: parsed.notAfter.toISOString(),
              },
            },
            tx,
          );
          if (signerKeyId) {
            await this.escrow(tx, principal, {
              key: subjectKey,
              signerKeyId,
              enrollmentId: enrollment.id,
              certificateId: created.id,
              csr: csr?.pem,
            });
          }
          return created.id;
        });
      // A key already the signer's (kept for an earlier certificate of
      // this import) is escrowed already.
      const id =
        takesKey && key?.location !== "signer"
          ? await this.keeping(brought, record)
          : await record();
      importedIds.push(id);
    }

    const rows = await this.prisma.certificate.findMany({
      where: { id: { in: [...importedIds, ...keyedIds] } },
      include: CERTIFICATE_LINEAGE,
      orderBy: [{ issuerId: "asc" }, { notAfter: "asc" }],
    });
    return {
      imported: rows
        .filter((row) => importedIds.includes(row.id))
        .map(toDomainObject),
      skipped,
      keyed: rows
        .filter((row) => keyedIds.includes(row.id))
        .map(toDomainObject),
    };
  }

  /**
   * Gives a certificate imported as a record its key, escrowed, and the
   * CSR it came from if it has none (ADR 0039): from its page rather than
   * by importing it again.
   */
  async addKey(
    principal: Principal,
    certificateId: string,
    request: AddCertificateKeyRequest,
  ): Promise<Certificate> {
    const row = await this.importedRow(certificateId);
    const enrollment = row.enrollment;
    if (request.csr && enrollment.csr) {
      throw new ConflictException("It has its CSR already");
    }
    const profile = await this.profiles.row(enrollment.profileId);
    if (!profile.allowGenerated) {
      throw new UnprocessableEntityException(
        `The ${profile.id} profile takes a CSR: its keys are the subscriber's`,
      );
    }
    const problem = await this.keyProblem(enrollment.key, enrollment.id);
    if (problem) {
      const sentence = problem.charAt(0).toUpperCase() + problem.slice(1);
      throw enrollment.key.location === "signer"
        ? new ConflictException(sentence)
        : new UnprocessableEntityException(sentence);
    }
    const csr = request.csr ? await this.csrOf(request.csr) : undefined;
    const ours = Buffer.from(enrollment.key.publicKey);
    if (csr && !csr.spki.equals(ours)) {
      throw new UnprocessableEntityException(
        "The CSR is not this certificate's: its public key differs",
      );
    }
    const spki = await this.publicKeyOf(request.key);
    if (!spki.equals(ours)) {
      throw new UnprocessableEntityException(
        "The key is not this certificate's: its public key differs",
      );
    }
    await this.keeping({ key: request.key, spki }, (signerKeyId) =>
      this.prisma.$transaction((tx) =>
        this.escrow(tx, principal, {
          key: enrollment.key,
          signerKeyId,
          enrollmentId: enrollment.id,
          certificateId: row.id,
          csr: csr?.pem,
        }),
      ),
    );
    return toDomainObject(await this.importedRow(certificateId));
  }

  /**
   * Keeps the CSR an imported certificate's escrowed key was certified
   * from (ADR 0039), when it has none: signed by that key.
   */
  async addCsr(
    principal: Principal,
    certificateId: string,
    request: AddCertificateCsrRequest,
  ): Promise<Certificate> {
    const row = await this.importedRow(certificateId);
    const enrollment = row.enrollment;
    if (enrollment.key.location !== "signer") {
      throw new UnprocessableEntityException(
        "A CSR comes with its key: add the key first",
      );
    }
    if (enrollment.csr) {
      throw new ConflictException("It has its CSR already");
    }
    const csr = await this.csrOf(request.csr);
    if (!csr.spki.equals(Buffer.from(enrollment.key.publicKey))) {
      throw new UnprocessableEntityException(
        "The CSR is not this certificate's: its public key differs",
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const kept = await tx.enrollment.updateMany({
        where: { id: enrollment.id, csr: null },
        data: { csr: bytes(Buffer.from(csr.pem, "utf8")) },
      });
      if (kept.count === 0) {
        throw new ConflictException("It has its CSR already");
      }
      await this.audit.record(
        {
          kind: AuditKind.CertificateCsrAdded,
          principal,
          subjectType: "certificate",
          subjectId: row.id,
          attributes: {
            enrollmentId: enrollment.id,
            subject: csr.subject,
          },
        },
        tx,
      );
    });
    return toDomainObject(await this.importedRow(certificateId));
  }

  /** A certificate imported from another CA product, with its enrollment. */
  private async importedRow(certificateId: string) {
    const row = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      include: CERTIFICATE_LINEAGE,
    });
    if (!row) {
      throw new NotFoundException(
        `Certificate with id ${certificateId} not found`,
      );
    }
    if (row.enrollment?.mode !== "imported") {
      throw new UnprocessableEntityException(
        "Only a certificate imported from another CA product is given its key or CSR",
      );
    }
    return { ...row, enrollment: row.enrollment };
  }

  /**
   * Does `work` with the brought key kept by the signer: imported now if
   * it is not yet, and destroyed again if `work` fails, so the signer
   * holds no key Harpocrates has no record of.
   */
  private async keeping<T>(
    brought: Brought,
    work: (signerKeyId: string) => Promise<T>,
  ): Promise<T> {
    const fresh = brought.signerKeyId === undefined;
    const signerKeyId = (brought.signerKeyId ??= await this.keep(brought.key));
    try {
      return await work(signerKeyId);
    } catch (error: unknown) {
      if (fresh) {
        brought.signerKeyId = undefined;
        await this.signer.destroyKey(signerKeyId).catch(() => undefined);
      }
      throw error;
    }
  }

  /** A CSR to keep with its key: PEM, and signed by the key it names. */
  private async csrOf(pem: string) {
    let csr;
    try {
      csr = await parseCsr(pem);
    } catch {
      throw new BadRequestException("The CSR is not PEM");
    }
    if (!csr.signatureValid) {
      throw new UnprocessableEntityException(
        "The CSR's signature does not verify",
      );
    }
    return csr;
  }

  /** The key's public half, read by the signer without keeping it. */
  private async publicKeyOf(imported: ImportedKey): Promise<Buffer> {
    const read = await this.signer.readKey(
      imported.data,
      imported.passphrase,
      imported.format,
    );
    return spkiFromPem(read.publicKey);
  }

  /** The key, now held by the signer: its ID there. */
  private async keep(imported: ImportedKey): Promise<string> {
    const key = await this.signer
      .importKey("subject", imported.data, imported.passphrase, imported.format)
      .catch((error: unknown) => {
        if (error instanceof ConflictException) {
          throw new ConflictException(
            "The signer has held this key before: it is not taken again",
          );
        }
        throw error;
      });
    return key.id;
  }

  private spkiOf(pem: string): Buffer | undefined {
    try {
      return parseCertificate(pem).spki;
    } catch {
      return undefined;
    }
  }

  /**
   * Why a certificate already here does not gain its key: revoked for
   * keyCompromise, already held, or its lineage has no valid certificate
   * left for escrow to keep it for.
   */
  private async keyProblem(
    key: KeyRow,
    enrollmentId: string,
  ): Promise<string | undefined> {
    if (key.blockedAt) return "its key was revoked for keyCompromise";
    if (key.location === "signer") return "its key is already escrowed";
    if (
      (await this.prisma.certificate.count({
        where: { enrollmentId, status: "valid" },
      })) === 0
    ) {
      return "revoked, so its key is not kept";
    }
    return undefined;
  }

  /** The key, now the signer's, escrowed; its CSR kept if its enrollment has none. */
  private async escrow(
    tx: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0],
    principal: Principal,
    escrowed: {
      key: KeyRow;
      signerKeyId: string;
      enrollmentId: string;
      certificateId: string;
      csr?: string;
    },
  ): Promise<void> {
    const key = await tx.key.update({
      where: { id: escrowed.key.id },
      data: { location: "signer", signerKeyId: escrowed.signerKeyId },
    });
    const csrKept =
      escrowed.csr !== undefined &&
      (
        await tx.enrollment.updateMany({
          where: { id: escrowed.enrollmentId, csr: null },
          data: { csr: bytes(Buffer.from(escrowed.csr, "utf8")) },
        })
      ).count > 0;
    await this.audit.record(
      {
        kind: AuditKind.KeyImported,
        principal,
        subjectType: "key",
        subjectId: key.id,
        attributes: {
          algorithm: key.algorithm,
          location: key.location,
          spkiSha256: key.spkiSha256,
          enrollmentId: escrowed.enrollmentId,
          certificateId: escrowed.certificateId,
          csr: csrKept,
        },
      },
      tx,
    );
  }

  /** The CA here whose key signed it, not merely one with that name. */
  private issuerOf(
    pem: string,
    parsed: ParsedCertificate,
    issuers: IssuerRow[],
  ): IssuerRow | undefined {
    return issuers.find(
      (issuer) =>
        issuer.subject === parsed.issuer &&
        isIssuedBy(pem, certificatePem(issuer.certificate!)),
    );
  }
}
