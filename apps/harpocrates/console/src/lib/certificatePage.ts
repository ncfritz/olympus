import type {
  AuditEvent,
  CertificateLineage,
  DashboardAuthority,
  DeployTarget,
  FullCertificate,
  Issuer,
} from "./api/types";

/**
 * One certificate's page: its chain, where it is used, the checks it
 * meets, its versions and its story, and what happens next.
 */

const DAY = 24 * 60 * 60 * 1000;

/** The days before expiry a renewal still pending counts as failing. */
export const URGENT_DAYS = 7;

/** The CAs above a certificate, its root first. */
export const chainOf = (issuerId: string, issuers: Issuer[]): Issuer[] => {
  const byId = new Map(issuers.map((i) => [i.id, i]));
  const chain: Issuer[] = [];
  for (
    let issuer = byId.get(issuerId);
    issuer && !chain.includes(issuer);
    issuer = issuer.parentId ? byId.get(issuer.parentId) : undefined
  ) {
    chain.unshift(issuer);
  }
  return chain;
};

/** The lineage a certificate is a version of, and its place in it. */
export const lineageOf = (
  certificateId: string,
  lineages: CertificateLineage[],
):
  | { lineage: CertificateLineage; index: number; number: number }
  | undefined => {
  for (const lineage of lineages) {
    const index = lineage.versions.findIndex(
      (v) => v.certificateId === certificateId,
    );
    if (index >= 0) {
      // Versions are newest first: the oldest is v1.
      return { lineage, index, number: lineage.versions.length - index };
    }
  }
  return undefined;
};

/** The deploy targets of a lineage: of any of its versions. */
export const targetsOf = (
  lineage: CertificateLineage | undefined,
  certificateId: string,
  targets: DeployTarget[],
): DeployTarget[] => {
  const ids = new Set(
    lineage ? lineage.versions.map((v) => v.certificateId) : [certificateId],
  );
  return targets.filter((t) => ids.has(t.certificateId));
};

/** The DNS names a certificate is for. */
export const dnsNamesOf = (certificate: FullCertificate): string[] =>
  certificate.names.dns ?? [];

/** Whether a DNS name falls within a subtree (a leading dot: below it). */
const within = (name: string, subtree: string): boolean => {
  const n = name.toLowerCase().replace(/^\*\./, "");
  const s = subtree.toLowerCase();
  return s.startsWith(".") ? n.endsWith(s) : n === s || n.endsWith(`.${s}`);
};

/** A check a certificate meets, or does not. */
export type Check = { ok: boolean; text: string };

/**
 * The rules of its CA it meets: its names within the CA's permitted
 * subtrees (and none excluded), its life within the CA's longest, its end
 * before the CA's, and its issuing within the CA's window.
 */
export const checksOf = (
  certificate: FullCertificate,
  issuer: Issuer | undefined,
): Check[] => {
  if (!issuer) return [];
  const checks: Check[] = [];
  const names = dnsNamesOf(certificate);
  const permitted = issuer.nameConstraints?.permitted?.dns ?? [];
  const excluded = issuer.nameConstraints?.excluded?.dns ?? [];
  if (permitted.length && names.length) {
    checks.push({
      ok: names.every((n) => permitted.some((s) => within(n, s))),
      text: `Its names inside the CA's permitted subtrees (${permitted.join(", ")})`,
    });
  }
  if (excluded.length && names.length) {
    checks.push({
      ok: !names.some((n) => excluded.some((s) => within(n, s))),
      text: `None of its names in the CA's excluded subtrees`,
    });
  }
  const days = Math.round(
    (Date.parse(certificate.notAfter) - Date.parse(certificate.notBefore)) /
      DAY,
  );
  if (issuer.maxValidityDays) {
    checks.push({
      ok: days <= issuer.maxValidityDays,
      text: `${days} days, within the CA's ${issuer.maxValidityDays}`,
    });
  }
  if (issuer.notAfter) {
    checks.push({
      ok: Date.parse(certificate.notAfter) <= Date.parse(issuer.notAfter),
      text: "Ends before its CA does",
    });
  }
  if (issuer.issuingWindowClosesAt) {
    checks.push({
      ok:
        Date.parse(certificate.notBefore) <=
        Date.parse(issuer.issuingWindowClosesAt),
      text: "Issued inside its CA's issuing window",
    });
  }
  return checks;
};

/** A CA's revocation as the chain shows it: its list and its OCSP. */
export const revocationOf = (
  authority: DashboardAuthority | undefined,
  now: number,
): { ok: boolean; text: string } => {
  if (!authority?.nextUpdate) return { ok: false, text: "No list published" };
  const lapsed = Date.parse(authority.nextUpdate) <= now;
  return {
    ok: !lapsed,
    text: lapsed
      ? `CRL ${authority.number} lapsed`
      : `CRL ${authority.number}${authority.ocspResponderUntil ? " · OCSP" : ""}`,
  };
};

/** What a target serves, against this certificate's versions. */
export const servedOf = (
  target: DeployTarget,
  certificate: FullCertificate,
  lineage: CertificateLineage | undefined,
): { label: string; color: string } => {
  const o = target.lastObservation;
  if (!o) return { label: "Not checked yet", color: "default" };
  if (o.result === "unreachable") return { label: "Unreachable", color: "red" };
  if (o.servedCertificateId === certificate.id) {
    return { label: "This version", color: "green" };
  }
  const version = lineage?.versions.findIndex(
    (v) => v.certificateId === o.servedCertificateId,
  );
  if (lineage && version !== undefined && version >= 0) {
    const number = lineage.versions.length - version;
    const newer =
      version <
      lineage.versions.findIndex((v) => v.certificateId === certificate.id);
    return {
      label: `${newer ? "A newer version" : "An older version"}: v${number}`,
      color: newer ? "blue" : "orange",
    };
  }
  return o.result === "current"
    ? { label: "Its current version", color: "green" }
    : { label: "Something else", color: "red" };
};

/** The groups of the story's events. */
export type StoryGroup = "issuance" | "deploys" | "revocation" | "keys";

export const storyGroupOf = (event: AuditEvent): StoryGroup =>
  event.kind.startsWith("deploy")
    ? "deploys"
    : event.kind.startsWith("key.")
      ? "keys"
      : event.kind === "certificate.revoked"
        ? "revocation"
        : "issuance";

/** An event, as the story tells it. */
export const STORY_KINDS: Record<string, string> = {
  "certificate.issued": "Issued",
  "certificate.renewed": "Renewed",
  "certificate.imported": "Imported",
  "certificate.revoked": "Revoked",
  "deployment.deployed": "Deployed",
  "deployment.failed": "Deploying failed",
  "deploy-target.created": "Deploy target made",
  "deploy-target.updated": "Deploy target changed",
  "deploy-target.deleted": "Deploy target removed",
  "key.exported": "Its key exported",
  "key.generated": "Its key made",
  "key.blocked": "Its key blocked",
};

/** Something coming up for a certificate, soonest first. */
export type NextStep = {
  key: string;
  at: number;
  color: string;
  text: string;
};

/**
 * What happens next to the current version: its renewal point, when a
 * renewal still pending counts as failing, and its expiry. Nothing for a
 * replaced, revoked or expired version.
 */
export const nextStepsOf = (
  certificate: FullCertificate,
  lineage: CertificateLineage | undefined,
  isCurrent: boolean,
  now: number,
): NextStep[] => {
  if (!isCurrent || certificate.state !== "valid") return [];
  const notAfter = Date.parse(certificate.notAfter);
  if (notAfter <= now) return [];
  const steps: NextStep[] = [];
  const automatic = lineage?.renewal === "automatic";
  if (lineage?.renewalDueAt) {
    const due = Date.parse(lineage.renewalDueAt);
    steps.push({
      key: "due",
      at: due,
      color: "blue",
      text: automatic
        ? due <= now
          ? "Its renewal is due: its renewer renews it on its next run."
          : "Its renewal becomes due: its renewer renews it from then."
        : "Its renewal is due: a person renews it, or issues its successor.",
    });
  }
  const urgent = notAfter - URGENT_DAYS * DAY;
  if (urgent > now) {
    steps.push({
      key: "urgent",
      at: urgent,
      color: "orange",
      text: "If still not renewed, the dashboard calls its renewal failing.",
    });
  }
  steps.push({
    key: "expires",
    at: notAfter,
    color: "red",
    text: "It expires.",
  });
  return steps.sort((a, b) => a.at - b.at);
};

/** How early each renewal came: days before the version it replaced ended. */
export const renewalLeads = (
  lineage: CertificateLineage | undefined,
): { version: number; days: number }[] => {
  if (!lineage) return [];
  const versions = [...lineage.versions].reverse(); // oldest first
  return versions.slice(1).map((v, i) => ({
    version: i + 2,
    days: Math.round(
      (Date.parse(versions[i].notAfter) - Date.parse(v.issuedAt)) / DAY,
    ),
  }));
};

/** A PEM block as DER bytes. */
export const derOf = (pem: string): Uint8Array<ArrayBuffer> => {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
};

/** Who renews a certificate, as a sentence says it. */
export const RENEWED_BY: Record<CertificateLineage["renewer"], string> = {
  acme: "its ACME client",
  "deploy-target": "its deploy target",
  mtls: "itself, over mTLS",
  person: "a person",
};
