import { Counter } from "prom-client";

/**
 * Calendar events consumed (ADR 0028), by action and what became of them:
 * `written` to Minerva, `unowned` (no user owns the account, acknowledged
 * and dropped), `invalid` (a message that can never be written,
 * dead-lettered) or `failed` (Hasura did not answer; requeued).
 */
const consumed = new Counter({
  name: "calendar_events_consumed_total",
  help: "Calendar events consumed from the sync agent, by action and result",
  labelNames: ["action", "result"],
});

export type CalendarEventResult = "written" | "unowned" | "invalid" | "failed";

export const recordCalendarEvent = (
  action: string,
  result: CalendarEventResult,
): void => {
  consumed.inc({ action, result });
};
