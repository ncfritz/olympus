import { Counter } from "prom-client";

/**
 * Calendar events consumed (ADR 0028), by action and what became of them:
 * `written` to Minerva, `unowned` (no user owns the account, acknowledged
 * and dropped), `invalid` (a message that can never be written,
 * dead-lettered), `retried` (Hasura failed; sent to a delay queue) or
 * `gave_up` (failed for the last time; dead-lettered).
 */
const consumed = new Counter({
  name: "calendar_events_consumed_total",
  help: "Calendar events consumed from the sync agent, by action and result",
  labelNames: ["action", "result"],
});

export type CalendarEventResult =
  "written" | "unowned" | "invalid" | "retried" | "gave_up";

export const recordCalendarEvent = (
  action: string,
  result: CalendarEventResult,
): void => {
  consumed.inc({ action, result });
};

const redriven = new Counter({
  name: "calendar_events_redriven_total",
  help: "Dead-lettered calendar events put back on the events queue",
});

export const recordCalendarEventRedrive = (count: number): void => {
  redriven.inc(count);
};
