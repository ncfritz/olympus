import type { AuditEvent, AuditGroup, AuditPoint } from "./api/types";
import { isPerson } from "./principals";

/**
 * The audit page's reading of the log: what each group and surface is
 * called, where an event's subject is, and the activity counted as its
 * graphs draw it, in the browser's own time.
 */

const DAY = 24 * 60 * 60 * 1000;

/** The groups, in the order the chips and lanes show them. */
export const GROUPS: { key: AuditGroup; label: string }[] = [
  { key: "certificates", label: "Certificates" },
  { key: "cas", label: "CAs" },
  { key: "ceremonies", label: "Ceremonies" },
  { key: "keys", label: "Keys" },
  { key: "signer", label: "Signer" },
  { key: "lists", label: "Lists" },
  { key: "ocsp", label: "OCSP" },
  { key: "acme", label: "ACME" },
  { key: "deploy", label: "Deploy" },
  { key: "profiles", label: "Profiles" },
  { key: "ssh", label: "SSH" },
  { key: "refused", label: "Refused" },
  { key: "other", label: "Other" },
];

export const GROUP_LABELS = Object.fromEntries(
  GROUPS.map((g) => [g.key, g.label]),
) as Record<AuditGroup, string>;

/** Where an event came from, in words and as a tag's colour. */
export const SURFACES: Record<string, { label: string; color: string }> = {
  api: { label: "Console / API", color: "purple" },
  cli: { label: "CLI", color: "orange" },
  acme: { label: "ACME", color: "blue" },
  renewal: { label: "Renewal", color: "gold" },
  system: { label: "Harpocrates", color: "default" },
};

/** The surfaces in the order the daily graph stacks them. */
export const SURFACE_ORDER = ["system", "renewal", "acme", "api", "cli"];

/** Where an event's subject is in the console, if it has a page. */
export const subjectHref = (event: AuditEvent): string | undefined => {
  if (!event.subjectId) return undefined;
  const id = encodeURIComponent(event.subjectId);
  switch (event.subjectType) {
    case "certificate":
      return `/certificates?certificateId=${id}`;
    case "issuer":
      return `/ca?id=${id}`;
    case "ceremony":
      return `/ceremony?id=${id}`;
    case "deploy-target":
      return `/deploy-targets?id=${id}`;
    case "profile":
      return `/profiles?id=${id}`;
    default:
      return undefined;
  }
};

/** The activity's counts, for the strip above the tabs. */
export const countsOf = (points: AuditPoint[], since: number) => {
  const shown = points.filter((p) => Date.parse(p.occurredAt) >= since);
  const people = shown.filter((p) => isPerson(p.principal));
  const byPerson = new Map<string, number>();
  for (const p of people) {
    byPerson.set(p.principal, (byPerson.get(p.principal) ?? 0) + 1);
  }
  return {
    events: shown.length,
    people: people.length,
    byPerson: [...byPerson.entries()].sort((a, b) => b[1] - a[1]),
    automatic: shown.length - people.length,
    sensitive: shown.filter((p) => p.sensitive).length,
    refused: shown.filter((p) => p.group === "refused").length,
  };
};

/** A local day's key: YYYY-MM-DD in the browser's time. */
const dayKey = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Each of the last `days` local days, oldest first, counted by surface. */
export const perDay = (
  points: AuditPoint[],
  days: number,
  now: number,
): { day: string; label: string; counts: Record<string, number> }[] => {
  const out = Array.from({ length: days }, (_, i) => {
    const time = now - (days - 1 - i) * DAY;
    return {
      day: dayKey(time),
      label: new Date(time).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      }),
      counts: Object.fromEntries(SURFACE_ORDER.map((s) => [s, 0])),
    };
  });
  const byDay = new Map(out.map((d) => [d.day, d]));
  for (const p of points) {
    const entry = byDay.get(dayKey(Date.parse(p.occurredAt)));
    if (entry) entry.counts[p.surface] = (entry.counts[p.surface] ?? 0) + 1;
  }
  return out;
};

/**
 * People's events by local weekday (Monday first) and hour: when people
 * act, so one at an odd hour stands out.
 */
export const peopleByHour = (points: AuditPoint[]): number[][] => {
  const grid = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  );
  for (const p of points.filter((p) => isPerson(p.principal))) {
    const d = new Date(p.occurredAt);
    grid[(d.getDay() + 6) % 7][d.getHours()] += 1;
  }
  return grid;
};

/** Events by group, most first. */
export const byGroup = (points: AuditPoint[]) => {
  const counts = new Map<AuditGroup, number>();
  for (const p of points) counts.set(p.group, (counts.get(p.group) ?? 0) + 1);
  return GROUPS.map((g) => ({ ...g, count: counts.get(g.key) ?? 0 }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);
};

/**
 * Who acted, most first: each person, then Harpocrates, ACME accounts and
 * holders renewing over mTLS, each together.
 */
export const byWho = (
  points: AuditPoint[],
): { key: string; principal?: string; label?: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const p of points) {
    const key = isPerson(p.principal)
      ? p.principal
      : p.principal === "system"
        ? "system"
        : p.principal.startsWith("acme:")
          ? "acme"
          : p.principal.startsWith("certificate:")
            ? "holders"
            : p.principal;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const labels: Record<string, string> = {
    system: "Harpocrates",
    acme: "ACME accounts",
    holders: "Holders, over mTLS",
  };
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      principal: labels[key] ? undefined : key,
      label: labels[key],
      count,
    }))
    .sort((a, b) => b.count - a.count);
};
