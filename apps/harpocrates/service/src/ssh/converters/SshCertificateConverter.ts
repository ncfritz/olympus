import moment from "moment";
import type {
  Key,
  ProfileVersion,
  SshCertificate as SshCertificateRow,
  SshCertificatePrincipal,
} from "../../store/prisma";
import type { CertificateStateName } from "../../model/certificates";
import type { KeyAlgorithmName } from "../../model/common";
import type { SshCertificate, SshCertificateContents } from "../../model/ssh";
import { parseSshCertificate } from "../../pki/ssh";

export const toSshCertificateContents = (
  certificate: string,
): SshCertificateContents => {
  const read = parseSshCertificate(certificate);
  return {
    ...read,
    serial: read.serial.toString(),
    validAfter: moment(read.validAfter),
    validBefore: moment(read.validBefore),
  };
};

export type SshCertificateWithRelations = SshCertificateRow & {
  principals: SshCertificatePrincipal[];
  key: Key;
  profileVersion: ProfileVersion;
};

export const SSH_CERTIFICATE_RELATIONS = {
  principals: true,
  key: true,
  profileVersion: true,
} as const;

export const sshStateOf = (
  row: Pick<SshCertificateRow, "status" | "validBefore">,
  now: Date = new Date(),
): CertificateStateName =>
  row.status === "revoked"
    ? "revoked"
    : row.validBefore <= now
      ? "expired"
      : "valid";

export const toSshCertificate = (
  row: SshCertificateWithRelations,
): SshCertificate => ({
  id: row.id,
  type: row.type,
  caId: row.sshCaId,
  profileId: row.profileId,
  profileVersion: row.profileVersion.version,
  serial: row.serial,
  keyIdentifier: row.keyIdentifier,
  identity: row.identity ?? undefined,
  principals: [...row.principals]
    .sort((a, b) => a.position - b.position)
    .map((p) => p.principal),
  keyAlgorithm: row.key.algorithm as KeyAlgorithmName,
  fingerprint: row.fingerprint,
  validAfter: moment(row.validAfter),
  validBefore: moment(row.validBefore),
  state: sshStateOf(row),
  revokedAt: row.revokedAt ? moment(row.revokedAt) : undefined,
  revocationReason: row.revocationReason ?? undefined,
  certificate: row.certificate,
  contents: toSshCertificateContents(row.certificate),
  renewsId: row.renewsId ?? undefined,
  createdAt: moment(row.createdAt),
  updatedAt: moment(row.updatedAt),
});
