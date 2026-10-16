import type {
  AttentionItem,
  Dashboard,
  CertificateHealth,
  DashboardEvent,
  DeployTarget,
  HandledCount,
  Issuer,
  Renewer,
  SignerStatus,
} from "./api/types";
import { principalName } from "./principals";

/**
 * The dashboard as the console shows it: how long until something, a
 * certificate's health and who renews it in words, where a certificate
 * sits on a timeline's lanes, where an attention item leads, audit events
 * in words, and the CA's health.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** "5 h", "4 days", "11 months", "3 y 9 m": how long until a time. */
export const timeUntil = (iso: string, now = Date.now()): string => {
  const left = Date.parse(iso) - now;
  if (left <= 0) return "now";
  if (left < DAY) return `${Math.max(1, Math.round(left / HOUR))} h`;
  const days = Math.round(left / DAY);
  if (days < 60) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months - years * 12;
  return rest ? `${years} y ${rest} m` : `${years} years`;
};

/** "3 days ago", "5 months ago": how long since a time. */
export const timeSince = (iso: string, now = Date.now()): string =>
  `${timeUntil(new Date(2 * now - Date.parse(iso)).toISOString(), now)} ago`;

/** A certificate's health, as the console names and colours it. */
export const HEALTH: Record<
  CertificateHealth,
  { label: string; color: string; order: number }
> = {
  failing: { label: "Failing", color: "red", order: 0 },
  "needs-person": { label: "Needs a person", color: "orange", order: 1 },
  renewing: { label: "Renewing", color: "blue", order: 2 },
  healthy: { label: "Healthy", color: "green", order: 3 },
  expired: { label: "Expired", color: "default", order: 4 },
};

/** Who renews a certificate, in words. */
export const RENEWERS: Record<Renewer, string> = {
  acme: "ACME",
  "deploy-target": "Deploy target",
  mtls: "Itself, over mTLS",
  person: "A person",
};

/** A certificate's short name on a lane: its first DNS label. */
export const shortName = (name: string): string =>
  /^[a-z0-9-]+\.[a-z0-9.-]+$/i.test(name) ? name.split(".")[0] : name;

/** The most rows a lane stacks its chips in before they overlap. */
export const LANE_ROWS = 3;

export type LaneChip<T> = {
  item: T;
  /** Its position along the lane, 0 to 100. */
  left: number;
  row: number;
};

/**
 * A lane's chips over `days` ahead, placed by when each falls and stacked
 * in rows so that close ones do not overlap (an eighth of the range
 * apart); past the last row they share it.
 */
export const placeChips = <T>(
  items: T[],
  at: (item: T) => string,
  days: number,
  now = Date.now(),
): LaneChip<T>[] => {
  const gap = days / 8;
  const lastDay: number[] = [];
  return [...items]
    .sort((a, b) => Date.parse(at(a)) - Date.parse(at(b)))
    .map((item) => {
      const day = (Date.parse(at(item)) - now) / DAY;
      let row = lastDay.findIndex((last) => day - last >= gap);
      if (row === -1) {
        row = Math.min(lastDay.length, LANE_ROWS - 1);
      }
      lastDay[row] = day;
      return {
        item,
        left: Math.min(Math.max((day / days) * 100, 0), 100),
        row,
      };
    });
};

/** Where an attention item leads in the console. */
export const attentionHref = (item: AttentionItem): string => {
  switch (item.subjectType) {
    case "certificate":
      return `/certificate?id=${item.subjectId}`;
    case "deploy-target":
      return `/deploy-targets?id=${item.subjectId}`;
    default:
      return `/ca?id=${item.subjectId}`;
  }
};

/** What an audit event did, as a phrase before what it concerns. */
const EVENT_PHRASES: Record<string, string> = {
  "certificate.issued": "Issued",
  "certificate.renewed": "Renewed",
  "certificate.imported": "Imported",
  "certificate.revoked": "Revoked",
  "crl.signed": "Signed a list for",
  "crl.imported": "Imported a list for",
  "crl.published": "Published the list of",
  "crl.publication-failed": "Could not publish the list of",
  "deployment.deployed": "Deployed to",
  "deployment.failed": "Could not deploy to",
  "ceremony.opened": "Opened a ceremony for",
  "ceremony.closed": "Closed a ceremony for",
  "issuer.created": "Created",
  "issuer.updated": "Changed",
  "issuer.renamed": "Gave another ID to",
  "issuer.proved": "Proved the backup of",
  "signer.sealed": "Sealed the signer",
  "signer.unsealed": "Unsealed the signer",
  "key.exported": "Exported the key of",
  "key.imported": "Imported a key",
  "certificate.csr-added": "Added the CSR of",
  "ocsp-responder.issued": "Issued an OCSP responder for",
  "ocsp-responder.retired": "Retired an OCSP responder for",
  "ssh-certificate.issued": "Issued an SSH certificate",
  "ssh-certificate.renewed": "Renewed an SSH host certificate",
  "ssh-certificate.revoked": "Revoked an SSH certificate",
  "ssh-krl.published": "Published a KRL",
  "acme-order.created": "ACME order",
  "acme-challenge.valid": "An ACME challenge passed",
  "acme-challenge.invalid": "An ACME challenge failed",
  "acme-account.created": "An ACME account registered",
  "acme-credential.created": "Created an ACME credential",
  "acme-credential.revoked": "Revoked an ACME credential",
  "deploy-target.created": "Created the deploy target",
  "deploy-target.updated": "Changed the deploy target",
  "deploy-target.deleted": "Deleted a deploy target",
  "profile.created": "Created a profile",
  "profile.updated": "Changed a profile",
  "key.generated": "Generated a key",
  "key.destroyed": "Destroyed a key",
  "ssh-ca.created": "Created an SSH CA",
  "ssh-principals.set": "Set SSH principals",
  "request.refused": "Refused a request",
};

/** An audit event in a sentence: "Renewed git.internal.ncfritz.net". */
export const describeEvent = (event: DashboardEvent): string => {
  const phrase = EVENT_PHRASES[event.kind] ?? event.kind;
  return event.subjectName ? `${phrase} ${event.subjectName}` : phrase;
};

/** Who did it, briefly: a person's email, ACME, a renewal, or Harpocrates. */
export const describeActor = (
  event: DashboardEvent,
  emails: Map<string, string> | undefined,
): string => {
  if (event.surface === "acme") return "ACME";
  if (event.surface === "renewal") return "Renewal";
  return principalName(event.principal, emails);
};

/** An event's colour on the timeline: failures red, issuance blue. */
export const eventColor = (event: DashboardEvent): string =>
  /revoked|failed|refused|sealed$/.test(event.kind)
    ? "red"
    : /\.(issued|renewed)$/.test(event.kind)
      ? "blue"
      : "gray";

/** The work done without a person that the dashboard counts, by kind and surface. */
const HANDLED: { kind: string; surface: string; label: string }[] = [
  {
    kind: "certificate.renewed",
    surface: "renewal",
    label: "Renewed over mTLS",
  },
  {
    kind: "certificate.issued",
    surface: "acme",
    label: "Issued to ACME clients",
  },
  {
    kind: "certificate.renewed",
    surface: "system",
    label: "Renewed for deploy targets",
  },
  { kind: "deployment.deployed", surface: "system", label: "Deployed" },
  {
    kind: "ssh-certificate.renewed",
    surface: "renewal",
    label: "SSH host certificates renewed",
  },
  { kind: "crl.signed", surface: "system", label: "Lists signed" },
  { kind: "crl.published", surface: "system", label: "Lists published" },
  { kind: "ssh-krl.published", surface: "system", label: "KRLs published" },
  {
    kind: "ocsp-responder.issued",
    surface: "system",
    label: "OCSP responders issued",
  },
];

/** What was handled without a person this week, in a fixed order, zeros out. */
export const handledRows = (
  counts: HandledCount[],
): { label: string; count: number }[] =>
  HANDLED.map(({ kind, surface, label }) => ({
    label,
    count:
      counts.find((c) => c.kind === kind && c.surface === surface)?.count ?? 0,
  })).filter((row) => row.count > 0);

export type HealthStatus = "ok" | "warning" | "error" | "neutral";

export type HealthCheck = {
  name: string;
  detail: string;
  status: HealthStatus;
};

/**
 * The CA's health, one line per part of it, from what the dashboard
 * already reads.
 */
export const healthChecks = ({
  dashboard,
  signer,
  issuers,
  targets,
  now,
}: {
  dashboard: Dashboard;
  signer: SignerStatus | undefined;
  issuers: Issuer[];
  targets: DeployTarget[];
  now: number;
}): HealthCheck[] => {
  const checks: HealthCheck[] = [];
  checks.push(
    !signer
      ? { name: "Signer", detail: "Reading its state", status: "neutral" }
      : !signer.initialised
        ? { name: "Signer", detail: "Not initialised", status: "warning" }
        : signer.sealed
          ? {
              name: "Signer",
              detail: "Sealed: nothing is signed",
              status: "error",
            }
          : { name: "Signer", detail: "Unsealed and signing", status: "ok" },
  );

  const crls = dashboard.authorities;
  const lapsed = crls.filter(
    (c) => !c.nextUpdate || Date.parse(c.nextUpdate) <= now,
  ).length;
  const waiting = crls.filter(
    (c) => c.number !== undefined && !c.publishedAt,
  ).length;
  const soonest = crls
    .filter((c) => !c.offline && c.nextUpdate)
    .map((c) => c.nextUpdate!)
    .sort()[0];
  checks.push({
    name: "Revocation lists",
    detail:
      `${crls.length - lapsed} of ${crls.length} current` +
      (waiting ? `, ${waiting} waiting to be published` : "") +
      (soonest ? `; the next lapses in ${timeUntil(soonest, now)}` : ""),
    status: lapsed ? "error" : waiting ? "warning" : "ok",
  });

  const { ocsp } = dashboard;
  const ocspLeft = ocsp.soonestLapse
    ? Date.parse(ocsp.soonestLapse) - now
    : undefined;
  checks.push({
    name: "OCSP",
    detail:
      `${ocsp.answering} CA${ocsp.answering === 1 ? "" : "s"} answering` +
      (ocsp.soonestLapse
        ? `; the soonest response lapses in ${timeUntil(ocsp.soonestLapse, now)}`
        : "") +
      (ocsp.missingOnline
        ? `; ${ocsp.missingOnline} online CA${ocsp.missingOnline === 1 ? "" : "s"} without a responder`
        : ""),
    status:
      ocspLeft !== undefined && ocspLeft <= 0
        ? "error"
        : ocsp.missingOnline || (ocspLeft !== undefined && ocspLeft < 2 * DAY)
          ? "warning"
          : "ok",
  });

  const closing = issuers.filter(
    (i) =>
      i.status === "active" &&
      !i.discardedAt &&
      i.issuingWindowClosesAt &&
      Date.parse(i.issuingWindowClosesAt) - now < 365 * DAY,
  );
  checks.push({
    name: "Issuing windows",
    detail: closing.length
      ? `${closing.length} CA${closing.length === 1 ? "" : "s"} stop${closing.length === 1 ? "s" : ""} issuing within a year`
      : "Every active CA issues for more than a year",
    status: closing.length ? "warning" : "ok",
  });

  const stale = targets.filter(
    (t) => t.lastObservation && t.lastObservation.result !== "current",
  ).length;
  const unstapled = targets.filter(
    (t) =>
      t.lastObservation?.servedMustStaple &&
      t.lastObservation.stapled === false,
  ).length;
  checks.push(
    targets.length === 0
      ? { name: "Deploy targets", detail: "None", status: "neutral" }
      : {
          name: "Deploy targets",
          detail:
            stale || unstapled
              ? [
                  stale && `${stale} not serving what was issued`,
                  unstapled && `${unstapled} must-staple without stapling`,
                ]
                  .filter(Boolean)
                  .join("; ")
              : `All ${targets.length} serve what was issued`,
          status: unstapled ? "error" : stale ? "warning" : "ok",
        },
  );

  const { week } = dashboard;
  checks.push({
    name: "ACME",
    detail:
      `${week.acmeOrders} order${week.acmeOrders === 1 ? "" : "s"} this week` +
      (week.acmeOrdersFailed
        ? `, ${week.acmeOrdersFailed} failed`
        : ", none failed"),
    status: week.acmeOrdersFailed ? "warning" : "ok",
  });

  checks.push({
    name: "Audit chain",
    detail: `${dashboard.ca.auditEvents.toLocaleString()} events; verified on request`,
    status: "neutral",
  });
  return checks;
};
