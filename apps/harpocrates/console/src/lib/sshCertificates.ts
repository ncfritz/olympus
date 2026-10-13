import type { SshCertificate } from "./api/types";

/**
 * The SSH certificates page's reading of its certificates (ADR 0035):
 * whom each is for, its state and time left, and the page's counts.
 */

const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** A certificate's state as the page shows it. */
export type ShownState =
  "valid" | "expiring" | "renewed" | "expired" | "revoked";

/** The certificates a newer one renews: valid still, but replaced. */
export const renewedIds = (certificates: SshCertificate[]): Set<string> =>
  new Set(certificates.flatMap((c) => (c.renewsId ? [c.renewsId] : [])));

/**
 * Valid, expiring (a user's within the hour, a host's past the point it
 * renews at, two thirds through), renewed (a newer one replaces it),
 * expired, or revoked.
 */
export const shownStateOf = (
  c: SshCertificate,
  now: number,
  renewed: Set<string> = new Set(),
): ShownState => {
  if (c.state === "revoked") return "revoked";
  const left = Date.parse(c.validBefore) - now;
  if (left <= 0) return "expired";
  if (renewed.has(c.id)) return "renewed";
  if (c.type === "user") return left < HOUR ? "expiring" : "valid";
  return left < lifeOf(c) / 3 ? "expiring" : "valid";
};

export const SHOWN_STATES: Record<
  ShownState,
  { label: string; color: string }
> = {
  valid: { label: "Valid", color: "green" },
  expiring: { label: "Expiring", color: "orange" },
  renewed: { label: "Renewed", color: "default" },
  expired: { label: "Expired", color: "default" },
  revoked: { label: "Revoked", color: "red" },
};

/** Whether a certificate can be used now: neither revoked nor expired. */
export const isCurrent = (c: SshCertificate, now: number): boolean =>
  c.state === "valid" &&
  Date.parse(c.validAfter) <= now &&
  Date.parse(c.validBefore) > now;

/** Whether a certificate is in use: current, and not replaced by a renewal. */
export const isLive = (
  c: SshCertificate,
  now: number,
  renewed: Set<string>,
): boolean => isCurrent(c, now) && !renewed.has(c.id);

/** A certificate's whole life, in milliseconds. */
export const lifeOf = (c: SshCertificate): number =>
  Date.parse(c.validBefore) - Date.parse(c.validAfter);

/** Its time left, in milliseconds (0 once over). */
export const leftOf = (c: SshCertificate, now: number): number =>
  Math.max(0, Date.parse(c.validBefore) - now);

/** "40 min", "5 h", "3 d". */
export const formatLeft = (ms: number): string =>
  ms < HOUR
    ? `${Math.max(1, Math.round(ms / 60000))} min`
    : ms < 48 * HOUR
      ? `${Math.round(ms / HOUR)} h`
      : `${Math.round(ms / DAY)} d`;

/** Whom a certificate is for: a person (their email) or a host (its name). */
export const holderOf = (c: SshCertificate): string =>
  c.type === "user"
    ? (c.identity ?? c.principals[0] ?? "A user")
    : (c.principals[0] ?? "A host");

/** A key, short: enough to tell one person's machines apart. */
export const shortFingerprint = (fingerprint: string): string =>
  fingerprint.replace(/^SHA256:/, "").slice(0, 8);

/**
 * A timeline lane's key: a person's key (one lane a machine), or a host.
 * A host's renewals keep its name, so one lane holds them all.
 */
export const laneOf = (c: SshCertificate): string =>
  c.type === "user" ? `${holderOf(c)} ${c.fingerprint}` : holderOf(c);

/** The page's counts. */
export const countsOf = (certificates: SshCertificate[], now: number) => {
  const renewed = renewedIds(certificates);
  const current = certificates.filter((c) => isLive(c, now, renewed));
  const users = current.filter((c) => c.type === "user");
  const hosts = current.filter((c) => c.type === "host");
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const today = certificates.filter(
    (c) => Date.parse(c.createdAt) >= midnight.getTime(),
  );
  const inKrl = certificates.filter(
    (c) => c.state === "revoked" && Date.parse(c.validBefore) > now,
  );
  const lastRevoked = certificates
    .filter((c) => c.revokedAt)
    .sort((a, b) => Date.parse(b.revokedAt!) - Date.parse(a.revokedAt!))[0];
  // Each host's newest current certificate: renewed by itself, or not.
  const byHost = new Map<string, SshCertificate>();
  for (const c of hosts) {
    const known = byHost.get(holderOf(c));
    if (!known || Date.parse(c.createdAt) > Date.parse(known.createdAt)) {
      byHost.set(holderOf(c), c);
    }
  }
  const nextRenewal = [...byHost.values()]
    .map((c) => ({
      host: holderOf(c).split(".")[0],
      at: Date.parse(c.validBefore) - lifeOf(c) / 3,
    }))
    .sort((a, b) => a.at - b.at)[0];
  return {
    current: current.length,
    users: users.length,
    hosts: hosts.length,
    expiringSoon: users.filter((c) => leftOf(c, now) < HOUR).length,
    today: today.length,
    todayPeople: today.filter((c) => c.type === "user").length,
    todayRenewals: today.filter((c) => c.type === "host" && c.renewsId).length,
    hostCount: byHost.size,
    hostsRenewing: [...byHost.values()].filter((c) => c.renewsId).length,
    nextRenewal,
    inKrl: inKrl.length,
    lastRevoked,
    people: new Set(users.map((c) => c.identity ?? c.principals[0])).size,
    principals: new Set(users.flatMap((c) => c.principals)).size,
  };
};

/**
 * Hosts whose renewal is due and that have never renewed themselves:
 * their first certificate was issued by hand and nothing renews it yet.
 */
export const hostsNotRenewing = (
  certificates: SshCertificate[],
  now: number,
): SshCertificate[] =>
  certificates.filter(
    (c) =>
      c.type === "host" &&
      isCurrent(c, now) &&
      !c.renewsId &&
      shownStateOf(c, now) === "expiring" &&
      // Not renewed since: no newer certificate for the same host.
      !certificates.some(
        (other) =>
          other.renewsId === c.id ||
          (other.type === "host" &&
            holderOf(other) === holderOf(c) &&
            Date.parse(other.createdAt) > Date.parse(c.createdAt)),
      ),
  );
