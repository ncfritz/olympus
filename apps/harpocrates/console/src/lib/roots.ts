import type {
  AttentionItem,
  DashboardAuthority,
  Issuer,
  IssuerTier,
} from "./api/types";
import { timeUntil } from "./dashboard";
import { childrenOf } from "./tree";

/**
 * The roots page's reading of the CAs: their hierarchy, with the CAs whose
 * root is not in Harpocrates (imported) apart, and what each one needs.
 */

const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365 * DAY;

/** The CAs the page shows: every one not discarded. */
export const shownIssuers = (issuers: Issuer[]): Issuer[] =>
  issuers.filter((issuer) => !issuer.discardedAt);

/**
 * The CAs beneath no root here: not a root, and their parent not among
 * the CAs (an imported CA whose root stayed outside). Their own children
 * come with them.
 */
export const outsideRoots = (issuers: Issuer[]): Issuer[] => {
  const ids = new Set(issuers.map((issuer) => issuer.id));
  return issuers.filter(
    (issuer) =>
      issuer.tier !== "root" && (!issuer.parentId || !ids.has(issuer.parentId)),
  );
};

/** A CA in the hierarchy's order, with how deep it sits. */
export type Placed = { issuer: Issuer; depth: number };

/** Every CA beneath these, depth first, each with its depth. */
export const inOrder = (
  issuers: Issuer[],
  tops: Issuer[],
  depth = 0,
): Placed[] =>
  tops.flatMap((issuer) => [
    { issuer, depth },
    ...inOrder(issuers, childrenOf(issuers, issuer.id), depth + 1),
  ]);

/** The roots, then the CAs outside them: the page's two groups. */
export const groupsOf = (issuers: Issuer[]) => ({
  roots: issuers.filter((issuer) => issuer.tier === "root"),
  outside: outsideRoots(issuers),
});

/** Whether a CA still issues, as a tag says it. */
export const windowOf = (
  issuer: Issuer,
  now: number,
): { label: string; color: string; closesAt?: number } => {
  if (issuer.status === "pending" || !issuer.notAfter) {
    return { label: "Not yet issued", color: "default" };
  }
  if (issuer.status !== "active") {
    return { label: "No longer issues", color: "default" };
  }
  const closes = Date.parse(issuer.issuingWindowClosesAt ?? issuer.notAfter);
  if (closes <= now) {
    return { label: "No longer issues", color: "default", closesAt: closes };
  }
  return {
    label: `Issues ${timeUntil(new Date(closes).toISOString(), now)}`,
    color: closes - now < YEAR ? "orange" : "green",
    closesAt: closes,
  };
};

/** Whether a CA's issuing window closes within a year, and still open. */
export const closingSoon = (issuer: Issuer, now: number): boolean => {
  const { closesAt } = windowOf(issuer, now);
  return (
    issuer.status === "active" &&
    closesAt !== undefined &&
    closesAt > now &&
    closesAt - now < YEAR
  );
};

/** Whether a CA's key is offline and its backup not yet proved. */
export const backupUnproved = (issuer: Issuer): boolean =>
  issuer.offline &&
  !issuer.provedAt &&
  (issuer.status === "active" || issuer.status === "pending");

/** A check's state, as the board's grid marks it. */
export type CheckState = "good" | "warning" | "error" | "none";

/** The checks the board shows for each CA, in its columns' order. */
export const CHECKS = ["Window", "List", "OCSP", "Backup"] as const;
export type Check = (typeof CHECKS)[number];

/**
 * A CA's checks: its issuing window (a year's warning), its list (an
 * offline CA's 60 days, an online one's two), its OCSP responder (the
 * same), and an offline key's backup.
 */
export const checksOf = (
  issuer: Issuer,
  authority: DashboardAuthority | undefined,
  now: number,
): Record<Check, CheckState> => {
  const live = issuer.status === "active";
  const margin = issuer.offline ? 60 * DAY : 2 * DAY;
  const lapse = (iso: string | undefined): CheckState => {
    if (!iso) return "error";
    const left = Date.parse(iso) - now;
    return left <= 0 ? "error" : left < margin ? "warning" : "good";
  };
  const window = windowOf(issuer, now);
  return {
    Window: !live
      ? "none"
      : window.color === "orange"
        ? "warning"
        : window.color === "green"
          ? "good"
          : "none",
    List: !authority ? "none" : lapse(authority.nextUpdate),
    OCSP:
      !authority || !live
        ? "none"
        : issuer.offline && !authority.ocspResponderUntil
          ? "none"
          : lapse(authority.ocspResponderUntil),
    Backup: !issuer.offline ? "none" : issuer.provedAt ? "good" : "error",
  };
};

/** A CA's state at a glance: the worst of its checks. */
export const worstOf = (checks: Record<Check, CheckState>): CheckState =>
  (["error", "warning", "good"] as const).find((state) =>
    Object.values(checks).includes(state),
  ) ?? "none";

/** A tier, in the plural, for a column of CAs. */
export const TIER_PLURALS: Record<IssuerTier, string> = {
  root: "Roots",
  intermediate: "Intermediates",
  issuing: "Issuing CAs",
};

/** Something coming up for the CAs, from soonest. */
export type ComingUp = {
  key: string;
  issuerId: string;
  at?: number;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
};

/**
 * What is coming up for the CAs: what the dashboard says needs a person
 * about them, then issuing windows closing within two years that it does
 * not yet name, soonest first.
 */
export const comingUp = (
  issuers: Issuer[],
  attention: AttentionItem[],
  now: number,
): ComingUp[] => {
  const ids = new Set(issuers.map((issuer) => issuer.id));
  const named = attention.filter(
    (item) => item.subjectType === "issuer" && ids.has(item.subjectId),
  );
  const windows = new Set(
    named.filter((i) => i.kind === "issuing-window").map((i) => i.subjectId),
  );
  const later: ComingUp[] = issuers
    .filter((issuer) => issuer.status === "active" && !windows.has(issuer.id))
    .flatMap((issuer) => {
      const { closesAt } = windowOf(issuer, now);
      return closesAt !== undefined &&
        closesAt > now &&
        closesAt - now < 2 * YEAR
        ? [
            {
              key: `window-${issuer.id}`,
              issuerId: issuer.id,
              at: closesAt,
              severity: "info" as const,
              title: "Stops issuing",
              detail:
                "What it signs must end before it does; a successor is planned in a ceremony with its parent.",
            },
          ]
        : [];
    });
  return [
    ...named.map((item) => ({
      key: `${item.kind}-${item.subjectId}`,
      issuerId: item.subjectId,
      at: item.dueAt ? Date.parse(item.dueAt) : undefined,
      severity: item.severity,
      title: item.title,
      detail: item.detail,
    })),
    ...later,
  ].sort((a, b) => (a.at ?? now) - (b.at ?? now));
};
