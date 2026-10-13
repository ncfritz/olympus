import type { Prisma } from "../store/prisma";

/**
 * The audit log's events by what they concern, as the console filters and
 * charts them, and which are sensitive: what a person reviewing the log
 * should see first. Read from the kind, `<subject>.<what>`.
 */

export const AUDIT_GROUP_VALUES = [
  "certificates",
  "cas",
  "ceremonies",
  "keys",
  "signer",
  "lists",
  "ocsp",
  "acme",
  "deploy",
  "profiles",
  "ssh",
  "refused",
  "other",
] as const;
export type AuditGroupName = (typeof AUDIT_GROUP_VALUES)[number];

/** Each group's kinds, by the start of the kind. */
const PREFIXES: Record<Exclude<AuditGroupName, "other">, string[]> = {
  certificates: ["certificate."],
  cas: ["issuer."],
  ceremonies: ["ceremony."],
  keys: ["key."],
  signer: ["signer."],
  lists: ["crl."],
  ocsp: ["ocsp-responder."],
  acme: ["acme-"],
  deploy: ["deployment.", "deploy-target."],
  profiles: ["profile."],
  ssh: ["ssh-"],
  refused: ["request.refused"],
};

/** The group a kind is in. */
export const groupOf = (kind: string): AuditGroupName =>
  (Object.entries(PREFIXES).find(([, prefixes]) =>
    prefixes.some((prefix) => kind.startsWith(prefix)),
  )?.[0] as AuditGroupName | undefined) ?? "other";

/**
 * Sensitive: a key leaving or entering, the signer's seal, a ceremony, a
 * revocation, a CA brought in or discarded, a profile or SSH mapping
 * changed, a request refused.
 */
const SENSITIVE_KINDS = new Set([
  "key.exported",
  "key.imported",
  "key.destroyed",
  "key.blocked",
  "certificate.revoked",
  "ssh-certificate.revoked",
  "issuer.imported",
  "issuer.discarded",
  "profile.updated",
  "profile.deactivated",
  "ssh-principals.set",
  "acme-credential.created",
  "acme-credential.revoked",
  "request.refused",
]);
const SENSITIVE_PREFIXES = ["signer.", "ceremony."];

/** Whether a kind is sensitive. */
export const isSensitive = (kind: string): boolean =>
  SENSITIVE_KINDS.has(kind) ||
  SENSITIVE_PREFIXES.some((prefix) => kind.startsWith(prefix));

/** The events in any of these groups, as a query's condition. */
export const inGroups = (
  groups: AuditGroupName[],
): Prisma.AuditEventWhereInput => {
  const prefixes = groups.flatMap((group) =>
    group === "other" ? [] : PREFIXES[group],
  );
  const conditions: Prisma.AuditEventWhereInput[] = prefixes.map((prefix) => ({
    kind: { startsWith: prefix },
  }));
  if (groups.includes("other")) {
    conditions.push({
      NOT: Object.values(PREFIXES)
        .flat()
        .map((prefix) => ({ kind: { startsWith: prefix } })),
    });
  }
  return { OR: conditions };
};

/** The sensitive events, as a query's condition. */
export const sensitiveOnly: Prisma.AuditEventWhereInput = {
  OR: [
    { kind: { in: [...SENSITIVE_KINDS] } },
    ...SENSITIVE_PREFIXES.map((prefix) => ({ kind: { startsWith: prefix } })),
  ],
};

/** Who acted, as the console filters it. */
export const AUDIT_ACTOR_VALUES = [
  "people",
  "system",
  "acme",
  "holders",
] as const;
export type AuditActorName = (typeof AUDIT_ACTOR_VALUES)[number];

export const byActor = (actor: AuditActorName): Prisma.AuditEventWhereInput =>
  actor === "people"
    ? {
        OR: [
          { principal: { startsWith: "user:" } },
          { principal: { startsWith: "cli:" } },
        ],
      }
    : actor === "system"
      ? { principal: "system" }
      : actor === "acme"
        ? { principal: { startsWith: "acme:" } }
        : { principal: { startsWith: "certificate:" } };
