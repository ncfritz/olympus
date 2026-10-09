import { Injectable } from "@nestjs/common";
import type { Issuer as IssuerRow } from "@prisma/client";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import type { Principal } from "../../auth/principal";
import { KeyService } from "../../keys/services/KeyService";
import type {
  ImportCertificatesRequest,
  ImportCertificatesResponse,
  SkippedCertificate,
} from "../../model/certificates";
import { ProfileService } from "../../profiles/services/ProfileService";
import {
  certificateNames,
  certificatePem,
  isIssuedBy,
  parseCertificate,
  type ParsedCertificate,
  splitCertificates,
} from "../../pki/x509";
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
 */
@Injectable()
export class CertificateImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileService,
    private readonly keys: KeyService,
    private readonly audit: AuditService,
  ) {}

  async import(
    principal: Principal,
    request: ImportCertificatesRequest,
  ): Promise<ImportCertificatesResponse> {
    const profile = await this.profiles.row(request.profileId);
    const issuers = (
      await this.prisma.issuer.findMany({ orderBy: { id: "asc" } })
    ).filter((issuer) => issuer.certificate !== null);
    const importedIds: string[] = [];
    const skipped: SkippedCertificate[] = [];

    for (const pem of request.certificates.flatMap((item) =>
      splitCertificates(item),
    )) {
      let parsed: ParsedCertificate;
      try {
        parsed = parseCertificate(pem);
      } catch {
        skipped.push({ reason: "Not a certificate" });
        continue;
      }
      const skip = (reason: string) =>
        skipped.push({
          subject: parsed.subject,
          serial: parsed.serial,
          reason,
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
      const existing = await this.prisma.certificate.findUnique({
        where: {
          issuerId_serial: { issuerId: issuer.id, serial: parsed.serial },
        },
      });
      if (existing) {
        skip("Already imported");
        continue;
      }
      const key = await this.keys.findBySpki(parsed.spki);
      if (key?.purpose === "issuer") {
        skip("Its key is a CA's");
        continue;
      }

      const id = await this.prisma.$transaction(async (tx) => {
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
        return created.id;
      });
      importedIds.push(id);
    }

    const rows = await this.prisma.certificate.findMany({
      where: { id: { in: importedIds } },
      include: CERTIFICATE_LINEAGE,
      orderBy: [{ issuerId: "asc" }, { notAfter: "asc" }],
    });
    return { imported: rows.map(toDomainObject), skipped };
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
