import { Counter } from "prom-client";

/**
 * Mail message metadata consumed (ADR 0030), by action and what became of
 * it: `written`, `stale` (Minerva holds a newer snapshot; skipped),
 * `unknown_account` (the account is gone; acknowledged and dropped),
 * `invalid` (can never be written; dead-lettered), `retried` (Hasura
 * failed; sent to a delay queue) or `gave_up` (failed for the last time;
 * dead-lettered).
 */
const consumed = new Counter({
  name: "mail_messages_consumed_total",
  help: "Mail message metadata consumed from the mail agent, by action and result",
  labelNames: ["action", "result"],
});

export type MailMessageResult =
  "written" | "stale" | "unknown_account" | "invalid" | "retried" | "gave_up";

export const recordMailMessage = (
  action: string,
  result: MailMessageResult,
): void => {
  consumed.inc({ action, result });
};
