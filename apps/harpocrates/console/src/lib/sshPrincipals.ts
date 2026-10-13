import type {
  AuditEvent,
  SshCertificate,
  SshPrincipalMapping,
} from "./api/types";

/**
 * The SSH principals page's reading (ADR 0035): each person's mapping
 * beside the user certificates they were signed, the grants worth a
 * look, and the mapping's changes from the audit log.
 */

const DAY = 24 * 60 * 60 * 1000;

/** How far back a grant counts as used: a certificate carried it. */
export const USAGE_DAYS = 90;

/** How many days a person's row draws. */
export const SPARK_DAYS = 30;

/** Accounts that hold a host: granting them is worth a second look. */
export const PRIVILEGED = new Set(["root", "admin", "toor"]);

/** One person's mapping, beside their user certificates. */
export type PersonRow = {
  identity: string;
  principals: string[];
  createdAt: string;
  updatedAt: string;
  /** Their user certificates (of those read), newest first. */
  certificates: SshCertificate[];
  /** Valid now. */
  current: SshCertificate[];
  lastSigned?: string;
  /** The principals a certificate carried in the last USAGE_DAYS. */
  used: Set<string>;
  /** Certificates signed each of the last SPARK_DAYS, oldest first. */
  perDay: number[];
};

const dayOf = (time: number) => {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Each mapping as a row, beside the certificates read. */
export const rowsOf = (
  mappings: SshPrincipalMapping[],
  certificates: SshCertificate[],
  now: number,
): PersonRow[] => {
  const today = dayOf(now);
  return mappings.map((m) => {
    const identity = m.identity.toLowerCase();
    const mine = certificates.filter(
      (c) => c.type === "user" && c.identity?.toLowerCase() === identity,
    );
    const recent = mine.filter(
      (c) => Date.parse(c.createdAt) > now - USAGE_DAYS * DAY,
    );
    const perDay = Array<number>(SPARK_DAYS).fill(0);
    for (const c of mine) {
      const i =
        SPARK_DAYS -
        1 -
        Math.round((today - dayOf(Date.parse(c.createdAt))) / DAY);
      if (i >= 0 && i < SPARK_DAYS) perDay[i] += 1;
    }
    return {
      identity: m.identity,
      principals: m.principals,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      certificates: mine,
      current: mine.filter(
        (c) =>
          c.state === "valid" &&
          Date.parse(c.validAfter) <= now &&
          Date.parse(c.validBefore) > now,
      ),
      lastSigned: mine[0]?.createdAt,
      used: new Set(recent.flatMap((c) => c.principals)),
      perDay,
    };
  });
};

/** Olympus people who have signed in to the console and have no mapping. */
export const unmappedOf = (
  emails: string[],
  mappings: SshPrincipalMapping[],
): string[] => {
  const mapped = new Set(mappings.map((m) => m.identity.toLowerCase()));
  return [...new Set(emails.map((e) => e.toLowerCase()))]
    .filter((e) => !mapped.has(e))
    .sort();
};

/** A grant worth a look, and why. */
export type ReviewItem = {
  key: string;
  identity: string;
  /** The principal in question; none for a person never signed. */
  principal?: string;
  reason: "privileged" | "unused" | "never";
  detail: string;
};

export const REASONS: Record<
  ReviewItem["reason"],
  { label: string; color: string }
> = {
  privileged: { label: "Privileged", color: "red" },
  unused: { label: `Unused ${USAGE_DAYS} days`, color: "orange" },
  never: { label: "Never signed", color: "gold" },
};

/**
 * The grants to look at, worst first: privileged ones (whether used or
 * not), ones granted at least USAGE_DAYS ago that no certificate carried
 * since, and people mapped who
 * have never been signed a certificate (of those read).
 */
export const reviewOf = (
  rows: PersonRow[],
  changes: Change[],
  now: number,
): ReviewItem[] => {
  /** When a person was last granted a principal, if the log says. */
  const grantedAt = (identity: string, principal: string) => {
    const change = changes.find(
      (c) => c.identity === identity && c.added.includes(principal),
    );
    return change ? Date.parse(change.at) : undefined;
  };
  const items: ReviewItem[] = [];
  for (const row of rows) {
    const mappedDays = Math.floor((now - Date.parse(row.createdAt)) / DAY);
    if (row.certificates.length === 0) {
      items.push({
        key: `${row.identity}:*`,
        identity: row.identity,
        reason: "never",
        detail: `Mapped ${mappedDays} days ago as ${row.principals.join(", ")}; never signed a certificate.`,
      });
      continue;
    }
    for (const principal of row.principals) {
      const used = row.used.has(principal);
      if (PRIVILEGED.has(principal)) {
        items.push({
          key: `${row.identity}:${principal}`,
          identity: row.identity,
          principal,
          reason: "privileged",
          detail: used
            ? `Full control of every host that trusts the user CA; carried in the last ${USAGE_DAYS} days.`
            : `Full control of every host that trusts the user CA, and no certificate carried it in ${USAGE_DAYS} days.`,
        });
      } else if (
        !used &&
        now -
          (grantedAt(row.identity, principal) ?? Date.parse(row.createdAt)) >=
          USAGE_DAYS * DAY
      ) {
        items.push({
          key: `${row.identity}:${principal}`,
          identity: row.identity,
          principal,
          reason: "unused",
          detail: `No certificate carried it in ${USAGE_DAYS} days.`,
        });
      }
    }
  }
  const rank = { privileged: 0, unused: 1, never: 2 };
  return items.sort((a, b) => rank[a.reason] - rank[b.reason]);
};

/** A change to a mapping, from the audit log. */
export type Change = {
  key: string;
  at: string;
  by: string;
  identity: string;
  added: string[];
  removed: string[];
};

const listOf = (value: string | undefined) =>
  value ? value.split(",").filter(Boolean) : [];

/** The audit log's ssh-principals.set events as changes, newest first. */
export const changesOf = (events: AuditEvent[]): Change[] =>
  events
    .filter((e) => e.subjectType === "ssh-identity" && e.subjectId)
    .map((e) => {
      const attr = (name: string) =>
        e.attributes.find((a) => a.name === name)?.value;
      const before = listOf(attr("before"));
      const after = listOf(attr("after"));
      return {
        key: e.sequence,
        at: e.occurredAt,
        by: e.principal,
        identity: e.subjectId!,
        added: after.filter((p) => !before.includes(p)),
        removed: before.filter((p) => !after.includes(p)),
      };
    });

/** The page's counts. */
export const countsOf = (
  rows: PersonRow[],
  unmapped: string[],
  review: ReviewItem[],
  changes: Change[],
) => {
  const principals = new Set(rows.flatMap((r) => r.principals));
  const privileged = rows.filter((r) =>
    r.principals.some((p) => PRIVILEGED.has(p)),
  );
  return {
    people: rows.length,
    everyone: rows.length + unmapped.length,
    principals: principals.size,
    principalNames: [...principals].sort(),
    privileged,
    holding: rows.filter((r) => r.current.length > 0).length,
    toReview: review.length,
    unused: review.filter((i) => i.reason !== "privileged").length,
    lastChange: changes[0],
  };
};
