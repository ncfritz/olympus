import type {
  SshActivityCertificate,
  SshCa,
  SshCaActivity,
  SshCertificateType,
} from "./api/types";

/**
 * The SSH CAs page's reading of its CAs (ADR 0035): each CA as a family
 * of generations (a rotation is the next), its rotation's steps, and the
 * graphs' series.
 */

const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** How many days the page's issuance covers. */
export const ACTIVITY_DAYS = 30;

/** How many days the KRL graph covers. */
export const KRL_DAYS = 90;

/** A CA's number of a type, and its generations, newest first. */
export type Family = {
  key: string;
  type: SshCertificateType;
  number: number;
  generations: SshCa[];
  /** The generation that signs: the newest active. */
  current?: SshCa;
};

/** The CAs as families: users' first, then by number. */
export const familiesOf = (cas: SshCa[]): Family[] => {
  const families = new Map<string, Family>();
  for (const ca of cas) {
    const key = `${ca.type}-${ca.number}`;
    const family = families.get(key) ?? {
      key,
      type: ca.type,
      number: ca.number,
      generations: [],
    };
    family.generations.push(ca);
    families.set(key, family);
  }
  return [...families.values()]
    .map((family) => {
      const generations = [...family.generations].sort(
        (a, b) => b.generation - a.generation,
      );
      return {
        ...family,
        generations,
        current: generations.find((g) => g.status === "active"),
      };
    })
    .sort(
      (a, b) =>
        (a.type === b.type ? 0 : a.type === "user" ? -1 : 1) ||
        a.number - b.number,
    );
};

/** A family's name, as the page heads it. */
export const familyName = (family: Family): string =>
  `${family.type === "user" ? "User" : "Host"} CA ${family.number}`;

/** What a type of CA vouches for. */
export const PURPOSE: Record<SshCertificateType, string> = {
  user: "who may log in",
  host: "what people log in to",
};

/** A CA's key type: the first word of its public key. */
export const keyTypeOf = (ca: SshCa): string => ca.publicKey.split(" ")[0];

/** Whether a CA has a newer generation beside it. */
export const isSuperseded = (ca: SshCa, cas: SshCa[]): boolean =>
  cas.some(
    (other) =>
      other.type === ca.type &&
      other.number === ca.number &&
      other.generation > ca.generation,
  );

/** A rotation's step: done, the next to do, or later. */
export type Step = {
  key: string;
  state: "done" | "next" | "later";
  title: string;
  detail?: string;
  at?: string;
};

/**
 * A family's rotation, from its previous generation to its newest, step
 * by step: the new generation made; its line installed beside the old
 * (Harpocrates cannot see hosts' files, so this is never marked done);
 * the old retired; the old's last certificate expired; the old's line
 * taken out. Undefined for a family of one generation.
 */
export const rotationOf = (
  family: Family,
  activity: Map<string, SshCaActivity>,
  now: number,
): Step[] | undefined => {
  const [newest, previous] = family.generations;
  if (!newest || !previous) return undefined;
  const g = (ca: SshCa) => `G${ca.generation}`;
  const where =
    family.type === "user"
      ? "every host's TrustedUserCAKeys file"
      : "every client's known_hosts";
  const lastExpires = activity.get(previous.id)?.lastExpiresAt;
  const expired =
    previous.status === "retired" &&
    (!lastExpires || Date.parse(lastExpires) <= now);
  const retired = previous.status === "retired";
  const steps: Step[] = [
    {
      key: "create",
      state: "done",
      title: `Create ${g(newest)}`,
      at: newest.createdAt,
    },
    {
      key: "install",
      state: retired ? "done" : "next",
      title: `Install ${g(newest)}'s line beside ${g(previous)}'s in ${where}`,
      detail:
        "Both are trusted for the overlap. Harpocrates cannot see the hosts' files: it counts this done once the old is retired.",
    },
    {
      key: "retire",
      state: retired ? "done" : "later",
      title: `Retire ${g(previous)}: ${g(newest)} signs everything new`,
      at: previous.retiredAt,
    },
    {
      key: "expire",
      state: expired ? "done" : retired ? "next" : "later",
      title: `${g(previous)}'s last certificate expires`,
      at: lastExpires,
    },
    {
      key: "remove",
      state: expired ? "next" : "later",
      title: `Take ${g(previous)}'s line out of ${where}`,
      detail: "Harpocrates cannot see the hosts' files: this one is yours.",
    },
  ];
  return steps;
};

/** Midnight (local) of the day a time falls in. */
const dayOf = (time: number): number => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** Each of the last `days`, oldest first: the certificates issued, by type. */
export const issuedByDay = (
  certificates: SshActivityCertificate[],
  days: number,
  now: number,
): { day: number; user: number; host: number }[] => {
  const today = dayOf(now);
  const rows = Array.from({ length: days }, (_, i) => ({
    day: today - (days - 1 - i) * DAY,
    user: 0,
    host: 0,
  }));
  const index = new Map(rows.map((row, i) => [row.day, i]));
  for (const certificate of certificates) {
    const i = index.get(dayOf(Date.parse(certificate.createdAt)));
    if (i !== undefined) rows[i][certificate.type] += 1;
  }
  return rows;
};

/**
 * Each of the last `days`, oldest first: the certificates in the KRLs at
 * the day's end (revoked, not yet expired), by type, and the revocations
 * made that day.
 */
export const krlByDay = (
  certificates: SshActivityCertificate[],
  days: number,
  now: number,
): { day: number; user: number; host: number; revoked: number }[] => {
  const today = dayOf(now);
  const revoked = certificates.filter((c) => c.revokedAt);
  return Array.from({ length: days }, (_, i) => {
    const day = today - (days - 1 - i) * DAY;
    const end = Math.min(day + DAY, now);
    const inKrl = revoked.filter(
      (c) => Date.parse(c.revokedAt!) < end && Date.parse(c.validBefore) > end,
    );
    return {
      day,
      user: inKrl.filter((c) => c.type === "user").length,
      host: inKrl.filter((c) => c.type === "host").length,
      revoked: revoked.filter(
        (c) =>
          Date.parse(c.revokedAt!) >= day &&
          Date.parse(c.revokedAt!) < day + DAY,
      ).length,
    };
  });
};

/** Each of the last `days`, oldest first: a CA's certificates issued. */
export const caIssuedByDay = (
  certificates: SshActivityCertificate[],
  caId: string,
  days: number,
  now: number,
): number[] => {
  const today = dayOf(now);
  const counts = Array<number>(days).fill(0);
  for (const c of certificates) {
    if (c.caId !== caId) continue;
    const i =
      days - 1 - Math.round((today - dayOf(Date.parse(c.createdAt))) / DAY);
    if (i >= 0 && i < days) counts[i] += 1;
  }
  return counts;
};

/** The certificates valid now, the least time left (as a share) first. */
export const validNow = (
  certificates: SshActivityCertificate[],
  now: number,
): (SshActivityCertificate & { left: number; share: number })[] =>
  certificates
    .filter(
      (c) =>
        !c.revokedAt &&
        Date.parse(c.validAfter) <= now &&
        Date.parse(c.validBefore) > now,
    )
    .map((c) => {
      const left = Date.parse(c.validBefore) - now;
      const life = Date.parse(c.validBefore) - Date.parse(c.validAfter);
      return { ...c, left, share: life > 0 ? left / life : 0 };
    })
    .sort((a, b) => a.left - b.left);

/** "5 h", "3 d": how long a certificate has left. */
export const formatLeft = (ms: number): string =>
  ms < 48 * HOUR
    ? `${Math.max(1, Math.round(ms / HOUR))} h`
    : `${Math.round(ms / DAY)} d`;

/** Who or what a certificate is for, in a word. */
export const holderOf = (certificate: SshActivityCertificate): string =>
  certificate.type === "user"
    ? (certificate.identity ?? certificate.principals[0] ?? "a user")
    : (certificate.principals[0] ?? "a host");

/** The user principals signed in the last days, most often first. */
export const principalsSigned = (
  certificates: SshActivityCertificate[],
  since: number,
): { principal: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const c of certificates) {
    if (c.type !== "user" || Date.parse(c.createdAt) < since) continue;
    for (const principal of c.principals) {
      counts.set(principal, (counts.get(principal) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([principal, count]) => ({ principal, count }))
    .sort((a, b) => b.count - a.count);
};

/** Whether the KRLs are current: none due and every CA's published. */
export const krlState = (
  cas: SshCa[],
): { current: boolean; publishedAt?: number } => {
  const due = cas.some((ca) => ca.krlDueAt || !ca.krlPublishedAt);
  const published = cas
    .map((ca) => (ca.krlPublishedAt ? Date.parse(ca.krlPublishedAt) : 0))
    .filter(Boolean);
  return {
    current: cas.length > 0 && !due,
    publishedAt: published.length ? Math.min(...published) : undefined,
  };
};
