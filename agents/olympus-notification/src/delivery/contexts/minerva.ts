import type { CalendarAccountClaimContext } from "@ncfritz/olympus-messages";
import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";

/** minerva_calendar_account_claim, as the API sends it (ADR 0028). */
export type MinervaCalendarAccountClaimContext = NotificationContext &
  CalendarAccountClaimContext;

/** What the claim's templates render. */
export interface MinervaCalendarAccountClaimMessageContext extends CalendarAccountClaimContext {
  /** `Google` or `Microsoft`. */
  providerName: string;
  /** The expiry, readable, in UTC. */
  expiresText: string;
}
