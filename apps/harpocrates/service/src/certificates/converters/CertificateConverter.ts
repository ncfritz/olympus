import type {
  Certificate as CertificateRow,
  Enrollment,
  EnrollmentName,
  Key,
  Revocation,
} from "@prisma/client";
import moment from "moment";
import type {
  Certificate,
  CertificateStateName,
  FullCertificate,
} from "../../model/certificates";
import type { Names, NameTypeName } from "../../model/common";
import { certificatePem } from "../../pki/x509";

export type CertificateWithLineage = CertificateRow & {
  revocation: Revocation | null;
  renewedBy: { id: string } | null;
  enrollment: (Enrollment & { key: Key; names: EnrollmentName[] }) | null;
};

export const CERTIFICATE_LINEAGE = {
  revocation: true,
  renewedBy: { select: { id: true } },
  enrollment: { include: { key: true, names: true } },
} as const;

export const stateOf = (
  row: CertificateRow,
  now: Date = new Date(),
): CertificateStateName =>
  row.status === "revoked"
    ? "revoked"
    : row.notAfter <= now
      ? "expired"
      : "valid";

export const buildNames = (names: EnrollmentName[]): Names => {
  const result: Names = {};
  for (const name of names) {
    const type = name.type as NameTypeName;
    result[type] = [...(result[type] ?? []), name.value];
  }
  return result;
};

export const toDomainObject = (row: CertificateWithLineage): Certificate => ({
  id: row.id,
  issuerId: row.issuerId,
  profileId: row.profileId ?? undefined,
  serial: row.serial,
  subject: row.subject,
  names: buildNames(row.enrollment?.names ?? []),
  notBefore: moment(row.notBefore),
  notAfter: moment(row.notAfter),
  state: stateOf(row),
  revocation: row.revocation
    ? {
        reason: row.revocation.reason,
        revokedAt: moment(row.revocation.revokedAt),
        principal: row.revocation.principal,
        comment: row.revocation.comment ?? undefined,
      }
    : undefined,
  keyLocation: row.enrollment?.key.location ?? "subscriber",
  keyAlgorithm: row.enrollment?.key.algorithm ?? "unknown",
  keyCreatedAt: moment(row.enrollment?.key.createdAt ?? row.createdAt),
  renewsId: row.renewsId ?? undefined,
  renewedById: row.renewedBy?.id,
});

export const toFullCertificate = (
  row: CertificateWithLineage,
  chain: string[],
): FullCertificate => ({
  ...toDomainObject(row),
  certificate: certificatePem(row.der),
  chain,
});
