import type {
  Calendar,
  CalendarAccount,
  CalendarAccountStatus,
  CalendarAccountVerification,
  CalendarProvider,
} from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";

/**
 * The Calendars page's logic (docs/plans/calendar-users, phase 7): what an
 * account's state says, what a sign-in's outcome says, colors and labels.
 * No I/O.
 */

export const CALENDARS_PATH = "/minerva/calendars";
export const CLAIM_PATH = "/minerva/calendars/claim";

export const PROVIDER_NAMES: Record<CalendarProvider, string> = {
  google: "Google",
  microsoft: "Microsoft",
};

/** The provider's badge on an account card. */
export const PROVIDER_BADGES: Record<
  CalendarProvider,
  { letter: string; color: string }
> = {
  google: { letter: "G", color: "#1a73e8" },
  microsoft: { letter: "M", color: "#5e5e5e" },
};

/* An account's state ------------------------------------------------------ */

export type AccountState = {
  /** The tag on the card. */
  label: string;
  /** An AntD tag color. */
  color: "success" | "warning" | "processing" | "error" | "default";
  /** Re-authorizing is the way out, so it is the card's primary action. */
  needsSignIn: boolean;
  /** Said under the card's header, when there is something to say. */
  explanation?: (provider: string) => string;
  /** The calendars can be changed (the agent holds a working sign-in). */
  canChangeCalendars: boolean;
};

export const accountState = (status: CalendarAccountStatus): AccountState => {
  switch (status) {
    case "ok":
      return {
        label: "Connected",
        color: "success",
        needsSignIn: false,
        canChangeCalendars: true,
      };
    case "expired":
      return {
        label: "Needs sign-in",
        color: "warning",
        needsSignIn: true,
        explanation: (provider) =>
          `${provider} stopped accepting this account's sign-in. Its calendars won't sync until you sign in again; nothing in Minerva is lost.`,
        canChangeCalendars: true,
      };
    case "reauth_pending":
      return {
        label: "Signing in…",
        color: "processing",
        needsSignIn: true,
        explanation: (provider) =>
          `A sign-in was started and hasn't finished. If you closed the ${provider} page, start again.`,
        canChangeCalendars: true,
      };
    case "error":
      return {
        label: "Sync failing",
        color: "error",
        needsSignIn: true,
        canChangeCalendars: true,
      };
    case "not_connected":
      return {
        label: "Not connected",
        color: "default",
        needsSignIn: true,
        explanation: () =>
          "Yours, but the calendar sync no longer holds a sign-in for it. Sign in to sync it again, or remove it.",
        canChangeCalendars: false,
      };
    default:
      return {
        label: "Status unavailable",
        color: "default",
        needsSignIn: false,
        canChangeCalendars: false,
      };
  }
};

/** Why the account is the user's, as its card says it. */
export const verificationText = (
  method: CalendarAccountVerification,
): string => {
  switch (method) {
    case "sign_in":
      return "Your Olympus sign-in";
    case "consent":
      return "Connected from Olympus";
    case "claim_email":
      return "Claimed by email";
    case "claim_consent":
      return "Claimed by signing in";
    default:
      return "Yours";
  }
};

/** The card's subtitle: provider, why it is theirs, since when. */
export const accountMeta = (account: CalendarAccount): string =>
  [
    PROVIDER_NAMES[account.provider] ?? account.provider,
    verificationText(account.verification),
  ].join(" · ") +
  `, ${DateTime.fromISO(account.verifiedTime).toFormat("MMM d, yyyy")}`;

/* Back from the provider -------------------------------------------------- */

export type SignInOutcome = {
  type: "success" | "info" | "warning" | "error";
  title: string;
  description: string;
  /** The account to offer Add calendars for. */
  accountId?: string;
};

/**
 * What the API's callback said, from the page's query
 * (`calendarAccount`, `reason`, `accountId`); undefined when the page was
 * not reached from a sign-in.
 */
export const signInOutcome = (
  query: Record<string, string | string[] | undefined>,
): SignInOutcome | undefined => {
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  switch (one("calendarAccount")) {
    case "connected":
      return {
        type: "success",
        title: "Account connected.",
        description: "Pick its calendars to start syncing.",
        accountId: one("accountId"),
      };
    case "cancelled":
      return {
        type: "info",
        title: "Sign-in cancelled.",
        description: "Nothing changed.",
      };
    case "expired":
      return {
        type: "warning",
        title: "That sign-in took too long.",
        description: "Sign-ins have ten minutes; start again.",
      };
    case "refused":
      return one("reason") === "another-account"
        ? {
            type: "error",
            title: "You signed in as a different account.",
            description:
              "To sign an account in again, sign in at the provider as that same account.",
          }
        : {
            type: "error",
            title: "That account belongs to another Olympus user.",
            description: "If that's wrong, ask an admin to release it.",
          };
    case "failed":
      return {
        type: "error",
        title: "Connecting didn't work.",
        description:
          "Try again in a minute; if it keeps failing, the calendar sync's log says why.",
      };
    default:
      return undefined;
  }
};

/** The query keys signInOutcome reads, to clear once shown. */
export const SIGN_IN_OUTCOME_KEYS = ["calendarAccount", "reason", "accountId"];

/* Calendars --------------------------------------------------------------- */

/** The colors offered, and given in turn to calendars without one. */
export const CALENDAR_COLORS = [
  "#1677ff",
  "#fa8c16",
  "#722ed1",
  "#13c2c2",
  "#eb2f96",
  "#52c41a",
  "#faad14",
  "#2f54eb",
];

/**
 * The color a calendar shows in: the user's choice, else one of
 * CALENDAR_COLORS picked from its label, so it stays put as calendars come
 * and go.
 */
export const calendarColor = (calendar: Calendar): string => {
  if (calendar.color) return calendar.color;
  let hash = 0;
  for (const char of calendar.source) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return CALENDAR_COLORS[hash % CALENDAR_COLORS.length]!;
};

/** Each account with its calendars, the accounts in the API's order. */
export const calendarsByAccount = (
  accounts: CalendarAccount[],
  calendars: Calendar[],
): { account: CalendarAccount; calendars: Calendar[] }[] =>
  accounts.map((account) => ({
    account,
    calendars: calendars
      .filter((c) => c.accountId === account.id)
      .sort((a, b) => a.source.localeCompare(b.source)),
  }));

/** When a calendar last synced, as its row says it. */
export const lastSyncedText = (
  calendar: Calendar,
  now: DateTime = DateTime.now(),
): string => {
  if (calendar.syncing) return "Syncing…";
  if (!calendar.lastSyncedTime) {
    return calendar.synced ? "Synced" : "Not yet";
  }
  const at = DateTime.fromISO(calendar.lastSyncedTime);
  const minutes = now.diff(at, "minutes").minutes;
  if (minutes < 1) return "Just now";
  if (minutes < 60) {
    const m = Math.floor(minutes);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  return at.toFormat("MMM d, yyyy");
};

/* Adding calendars -------------------------------------------------------- */

/**
 * A label for a calendar from its name: lower case, words joined by `-`,
 * at most 64 characters. The user can change it.
 */
export const suggestSource = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "") || "calendar";

/**
 * What is wrong with a label, given the labels already taken (synced, or
 * picked for another calendar in the same drawer); undefined when it is
 * fine. The API says the last word: a label another user's calendar has
 * is a 409.
 */
export const sourceProblem = (
  source: string,
  taken: string[],
): string | undefined => {
  const label = source.trim();
  if (!label) return "Give it a label.";
  if (label.length > 64) return "At most 64 characters.";
  if (taken.includes(label)) {
    return `Another calendar already uses “${label}”.`;
  }
  return undefined;
};

/* Claims ------------------------------------------------------------------ */

/** Whether `value` looks enough like an address to claim. */
export const isEmailAddress = (value: string): boolean =>
  value.trim().length <= 254 && /^[^\s@]+@[^\s@]+$/.test(value.trim());

/** The page the claim's link opens, on this site. */
export const claimConfirmPage = (origin: string): string =>
  `${origin.replace(/\/+$/, "")}${CLAIM_PATH}`;

/** This page with nothing in its query: where a sign-in comes back to. */
export const calendarsReturnTo = (origin: string): string =>
  `${origin.replace(/\/+$/, "")}${CALENDARS_PATH}`;

export type ClaimProblem = {
  title: string;
  description: string;
  /** Offer to claim again. */
  claimAgain?: boolean;
};

/** What the claim page says when the API refuses the link, by status. */
export const claimProblem = (status: number | undefined): ClaimProblem => {
  switch (status) {
    case 403:
      return {
        title: "This claim isn't yours",
        description:
          "Another Olympus user asked for this link. Only they can confirm it, signed in as themselves. Nothing changed.",
      };
    case 404:
      return {
        title: "We don't know this link",
        description: "Check you opened the whole link from the email.",
      };
    case 409:
      return {
        title: "The account has an owner",
        description:
          "Someone linked it since you asked. If that's wrong, an admin can release it so you can claim it again.",
      };
    case 410:
      return {
        title: "This link has expired",
        description:
          "Links work once, for a day. Claim the account again from Calendars to get a new one.",
        claimAgain: true,
      };
    default:
      return {
        title: "Something went wrong",
        description: "Try the link again in a minute.",
      };
  }
};

/** The HTTP status of a failed API call, if it had one. */
export const errorStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;
