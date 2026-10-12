import type {
  CertificateHealth,
  CertificateLineage,
  LineageVersion,
  Renewer,
} from "./api/types";

/**
 * The certificates page's reading of the lineages: what each holds now,
 * when it expires, which alert it falls under, and what was issued when.
 */

const DAY = 24 * 60 * 60 * 1000;

/** A lineage's newest version: what its subject holds now. */
export const newestOf = (lineage: CertificateLineage): LineageVersion =>
  lineage.versions[0];

/** Days until its newest version expires; negative once it has. */
export const daysLeft = (lineage: CertificateLineage, now: number): number =>
  Math.ceil((Date.parse(newestOf(lineage).notAfter) - now) / DAY);

/** Whether its subject holds a valid certificate now. */
export const isHeld = (lineage: CertificateLineage): boolean =>
  lineage.state === "valid";

/**
 * The times its subject held nothing valid between two versions: one
 * version expired (or was revoked) before the next began.
 */
export const gapsOf = (
  lineage: CertificateLineage,
): { from: number; to: number }[] => {
  const oldestFirst = [...lineage.versions].reverse();
  return oldestFirst.slice(1).flatMap((version, i) => {
    const before = oldestFirst[i];
    const ended = Math.min(
      Date.parse(before.notAfter),
      before.revokedAt ? Date.parse(before.revokedAt) : Infinity,
    );
    const began = Date.parse(version.notBefore);
    return began > ended ? [{ from: ended, to: began }] : [];
  });
};

/** The alerts a lineage can fall under, as the page's two panels count. */
export const BUCKETS = {
  expired30: {
    label: "Expired",
    sub: "last 30 days",
    test: (l: CertificateLineage, now: number) =>
      l.state === "expired" && daysLeft(l, now) > -30,
  },
  d7: {
    label: "Expires in",
    sub: "0–7 days",
    test: (l: CertificateLineage, now: number) =>
      isHeld(l) && daysLeft(l, now) <= 7,
  },
  d30: {
    label: "Expires in",
    sub: "8–30 days",
    test: (l: CertificateLineage, now: number) =>
      isHeld(l) && daysLeft(l, now) > 7 && daysLeft(l, now) <= 30,
  },
  d60: {
    label: "Expires in",
    sub: "31–60 days",
    test: (l: CertificateLineage, now: number) =>
      isHeld(l) && daysLeft(l, now) > 30 && daysLeft(l, now) <= 60,
  },
  d90: {
    label: "Expires in",
    sub: "61–90 days",
    test: (l: CertificateLineage, now: number) =>
      isHeld(l) && daysLeft(l, now) > 60 && daysLeft(l, now) <= 90,
  },
  failing: {
    label: "Failing",
    sub: "a week or less left",
    test: (l: CertificateLineage) => isHeld(l) && l.health === "failing",
  },
  needsPerson: {
    label: "Needs a person",
    sub: "nothing renews them",
    test: (l: CertificateLineage) => isHeld(l) && l.health === "needs-person",
  },
  renewing: {
    label: "Renewing",
    sub: "in hand",
    test: (l: CertificateLineage) => isHeld(l) && l.health === "renewing",
  },
  gaps: {
    label: "Gaps between versions",
    sub: "in the last year",
    test: (l: CertificateLineage, now: number) =>
      gapsOf(l).some((gap) => gap.to > now - 365 * DAY),
  },
} as const;
export type Bucket = keyof typeof BUCKETS;
export const EXPIRY_BUCKETS: Bucket[] = [
  "expired30",
  "d7",
  "d30",
  "d60",
  "d90",
];
export const RENEWAL_BUCKETS: Bucket[] = [
  "failing",
  "needsPerson",
  "renewing",
  "gaps",
];

/** The headline counts above the tabs. */
export const countsOf = (lineages: CertificateLineage[], now: number) => {
  const held = lineages.filter(isHeld);
  const thisMonth = held.filter(
    (l) => Date.parse(l.renewalDueAt) <= now + 30 * DAY,
  );
  const renewedRecently = lineages.flatMap((l) =>
    l.versions
      .filter((v) => v.renews && Date.parse(v.issuedAt) > now - 30 * DAY)
      .map(() => l.renewer),
  );
  const byRenewer = (renewer: Renewer) =>
    renewedRecently.filter((r) => r === renewer).length;
  return {
    held: held.length,
    versions: lineages.reduce((sum, l) => sum + l.versions.length, 0),
    thisMonth: thisMonth.length,
    thisMonthThemselves: thisMonth.filter((l) => l.renewal === "automatic")
      .length,
    needPerson: held.filter(
      (l) => l.health === "failing" || l.health === "needs-person",
    ).length,
    failing: held.filter((l) => l.health === "failing").length,
    manual: held.filter((l) => l.health === "needs-person").length,
    renewed: renewedRecently.length,
    renewedBy: {
      acme: byRenewer("acme"),
      mtls: byRenewer("mtls"),
      "deploy-target": byRenewer("deploy-target"),
      person: byRenewer("person"),
    } as Record<Renewer, number>,
    ended: lineages.length - held.length,
  };
};

/** Held certificates by whether their renewal is in hand. */
export const healthCounts = (
  lineages: CertificateLineage[],
): Record<Exclude<CertificateHealth, "expired">, number> => {
  const counts = { healthy: 0, renewing: 0, "needs-person": 0, failing: 0 };
  for (const l of lineages.filter(isHeld)) {
    if (l.health && l.health !== "expired") counts[l.health] += 1;
  }
  return counts;
};

/** Held certificates by who renews them. */
export const renewerCounts = (
  lineages: CertificateLineage[],
): Record<Renewer, number> => {
  const counts = { acme: 0, "deploy-target": 0, mtls: 0, person: 0 };
  for (const l of lineages.filter(isHeld)) counts[l.renewer] += 1;
  return counts;
};

/** The last 12 months, oldest first: certificates new, and renewals. */
export const issuedByMonth = (
  lineages: CertificateLineage[],
  now: number,
): { month: string; label: string; issued: number; renewed: number }[] => {
  const today = new Date(now);
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11 + i, 1),
    );
    return {
      month: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString(undefined, {
        month: "short",
        timeZone: "UTC",
      }),
      issued: 0,
      renewed: 0,
    };
  });
  const byMonth = new Map(months.map((m) => [m.month, m]));
  for (const v of lineages.flatMap((l) => l.versions)) {
    const entry = byMonth.get(v.issuedAt.slice(0, 7));
    if (entry) entry[v.renews ? "renewed" : "issued"] += 1;
  }
  return months;
};

/** The held certificates expiring in each of the next `weeks` weeks. */
export const expiringByWeek = (
  lineages: CertificateLineage[],
  now: number,
  weeks: number,
): number[] => {
  const counts = Array.from({ length: weeks }, () => 0);
  for (const l of lineages.filter(isHeld)) {
    const week = Math.floor(
      (Date.parse(newestOf(l).notAfter) - now) / (7 * DAY),
    );
    if (week >= 0 && week < weeks) counts[week] += 1;
  }
  return counts;
};
