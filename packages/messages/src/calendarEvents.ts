/**
 * Calendar events: the Minerva calendar sync agent publishes a full
 * snapshot of an event to CALENDAR_EVENTS_EXCHANGE whenever sync changes
 * it, and again on request (backfill). Delivery is at least once, through
 * the agent's transactional outbox; consumers upsert by the event's `id`
 * (`<source>:<uid>`), and the AMQP `messageId` is the outbox row's id.
 *
 * Other services consume these messages, so the payload also has a JSON
 * Schema: schemas/calendar-event.schema.json.
 */

import { exchange, route } from "./routing";

export const CALENDAR_EVENTS_EXCHANGE = exchange("calendar.events", "topic");

/**
 * Why the event was published. `backfill` carries the same snapshot as
 * `upsert`, so a consumer can tell a resend of current state from a live
 * change (for example to skip notifications).
 */
export const CALENDAR_EVENT_ACTIONS = ["upsert", "delete", "backfill"] as const;
export type CalendarEventAction = (typeof CALENDAR_EVENT_ACTIONS)[number];

export type CalendarEventSensitivity =
  "normal" | "personal" | "private" | "confidential";
export type CalendarEventImportance = "low" | "normal" | "high";
export type CalendarEventOccurrenceType =
  "single" | "occurrence" | "series_master";
export type CalendarEventType = "appointment" | "meeting" | "other";
export type CalendarEventResponse =
  "organizer" | "accepted" | "declined" | "tentative" | "needs_action";
export type CalendarEventFreeBusyStatus =
  "free" | "busy" | "tentative" | "out_of_office" | "working_elsewhere";

/** A provider-independent snapshot of one calendar event. */
export interface CalendarEventMessage {
  /** `<source>:<uid>`: the key to upsert by. */
  id: string;
  subject: string;
  sensitivity: CalendarEventSensitivity;
  importance: CalendarEventImportance;
  occurrenceType: CalendarEventOccurrenceType;
  type: CalendarEventType;
  /** Whether a reminder is set. */
  reminder: boolean;
  /** The calendar owner's response. */
  response: CalendarEventResponse;
  /** ISO-8601. */
  startTime: string;
  /** ISO-8601. */
  endTime: string;
  /** Minutes. */
  duration: number;
  allDay: boolean;
  /** How the event shows on the owner's free/busy. */
  status: CalendarEventFreeBusyStatus;
  location: string | null;
  cancelled: boolean;
  organizerEmail: string | null;
  /** The event was removed at the provider; true on `delete`. */
  deleted: boolean;
  /** The provider's stable identifier (for example Google's iCalUID). */
  uid: string;
  /** The `uid` of the series master, for an occurrence. */
  recurrenceId: string | null;
  /** The configured calendar the event came from. */
  source: string;
  /**
   * The provider's recurrence description of the series, for reference
   * only: RFC 5545 RRULE/EXDATE lines for Google, the Graph `recurrence`
   * pattern as JSON text for Microsoft. Occurrences arrive as their own
   * messages.
   */
  recurrenceRule: string | null;
}

/** `event.<action>` on CALENDAR_EVENTS_EXCHANGE. */
export const calendarEventRoute = (action: CalendarEventAction) =>
  route<CalendarEventMessage>(CALENDAR_EVENTS_EXCHANGE, `event.${action}`);
