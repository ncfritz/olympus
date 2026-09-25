/** What the audit log records (ADR 0020, Audit). Dotted: `<subject>.<what>`. */
export const AuditKind = {
  IssuerCreated: "issuer.created",
  IssuerImported: "issuer.imported",
  IssuerCompleted: "issuer.completed",
  CeremonyOpened: "ceremony.opened",
  CeremonyClosed: "ceremony.closed",
  KeyGenerated: "key.generated",
  KeyImported: "key.imported",
  KeyDestroyed: "key.destroyed",
  KeyBlocked: "key.blocked",
  KeyExported: "key.exported",
  RequestRefused: "request.refused",
  CertificateIssued: "certificate.issued",
  CertificateRenewed: "certificate.renewed",
  CertificateRevoked: "certificate.revoked",
  ProfileUpdated: "profile.updated",
  SignerSealed: "signer.sealed",
  SignerUnsealed: "signer.unsealed",
} as const;

export type AuditKindName = (typeof AuditKind)[keyof typeof AuditKind];
