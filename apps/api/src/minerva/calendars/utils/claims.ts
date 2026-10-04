import { randomBytes } from "crypto";
import type { RateLimit } from "../../../auth/limits/RateLimiter";
import { hashState } from "./signIns";

export {
  CALENDAR_ACCOUNT_CLAIM_NOTIFICATION as CLAIM_NOTIFICATION_TYPE,
  type CalendarAccountClaimContext as ClaimEmailContext,
} from "@ncfritz/olympus-messages";

/** How long a claim's link works (ADR 0028). */
export const CLAIM_LIFETIME_MS = 24 * 60 * 60 * 1000;

/**
 * Five claims per user a day (ADR 0028), counted whether or not an account
 * has the address, so the limit says nothing about which accounts exist.
 * The ceiling bounds the mail Olympus sends for everyone together.
 *
 * Held in memory, like the sign-in limits: an API restart forgets it. It
 * contains mail to an address, which a restart now and then does not undo.
 */
export const CLAIM_LIMIT: RateLimit = {
  perClient: 5,
  global: 100,
  windowSeconds: 24 * 60 * 60,
};

/** A claim's random token, and the hash that is all that is stored. */
export const newClaimToken = (): { value: string; hash: string } => {
  const value = randomBytes(32).toString("base64url");
  return { value, hash: hashState(value) };
};

/** The confirm page with the claim's token in its query. */
export const claimLink = (confirmPage: string, token: string): string => {
  const url = new URL(confirmPage);
  url.searchParams.set("token", token);
  return url.href;
};

export type ClaimState = "open" | "expired" | "confirmed" | "cancelled";

/** Where a claim is: confirmed and cancelled are final; open until it expires. */
export const claimState = (
  claim: {
    expiresTime: string;
    confirmedTime: string | null;
    cancelledTime: string | null;
  },
  now: Date,
): ClaimState => {
  if (claim.confirmedTime) return "confirmed";
  if (claim.cancelledTime) return "cancelled";
  if (Date.parse(claim.expiresTime) <= now.getTime()) return "expired";
  return "open";
};

/**
 * Enough of an address to mail: one `@` with something either side, no
 * spaces, at most 254 characters. The provider has already checked the
 * stored ones; this keeps nonsense out of the query.
 */
export const isEmailAddress = (value: string): boolean =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(value);

/** `value` as an `_ilike` pattern that matches only itself, in any case. */
export const likeExactly = (value: string): string =>
  value.replace(/[\\%_]/g, (c) => `\\${c}`);
