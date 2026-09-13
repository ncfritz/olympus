import type { calendar_v3 } from "googleapis";
import {
  buildCanonicalEventId,
  CanonicalCalendarEvent,
  EventType,
  FreeBusyStatus,
  Importance,
  IMPORTANCE_VALUES,
  OccurrenceType,
  ResponseStatus,
  Sensitivity,
} from "../../domain/canonical-event";
import { RemovalTombstone } from "../calendar-provider";

type GoogleEvent = calendar_v3.Schema$Event;

/**
 * Incremental sync reports removed events as minimal records — Google's docs
 * guarantee only `id` and `status: "cancelled"`, so these must be checked
 * before `mapGoogleEventToCanonical`, which needs far more than that.
 */
export function isGoogleRemoval(raw: GoogleEvent): boolean {
  return raw.status === "cancelled";
}

/**
 * Google's own convention for events it created is `iCalUID = "<id>@google.com"`
 * (this does NOT hold for events imported from another system, e.g. via ICS —
 * their iCalUID is whatever the source system assigned). A removal record
 * usually lacks iCalUID entirely, so we derive it with that convention as a
 * documented best-effort heuristic. If a stored row doesn't actually match
 * (imported event, convention doesn't hold), the mark-as-removed call is a
 * harmless no-op — the next full resync's diff pass catches it regardless.
 */
export function resolveGoogleRemoval(raw: GoogleEvent): RemovalTombstone {
  if (!raw.id) {
    throw new Error("Google removal record has no id");
  }
  return {
    uid: raw.iCalUID ?? `${raw.id}@google.com`,
    isOccurrence: Boolean(raw.recurringEventId),
  };
}

/**
 * Google Calendar's API has no native equivalent for several of our fields
 * (importance, appointment/meeting/other type). Each of those is a
 * documented heuristic below, not something Google actually told us.
 */
export function mapGoogleEventToCanonical(
  raw: GoogleEvent,
  ctx: { source: string },
): CanonicalCalendarEvent {
  if (!raw.id) {
    throw new Error("Google event has no id");
  }

  // Normally always present, but some legacy/malformed recurring instances
  // come back without it even when not cancelled — same documented
  // derivation heuristic as resolveGoogleRemoval, rather than failing the
  // whole sync over one odd event.
  const uid = raw.iCalUID ?? `${raw.id}@google.com`;
  const { startTime, endTime, allDay } = mapTimes(raw);

  return {
    id: buildCanonicalEventId(ctx.source, uid),
    subject: raw.summary ?? "(No title)",
    sensitivity: mapSensitivity(raw.visibility),
    importance: mapImportance(raw),
    occurrenceType: mapOccurrenceType(raw),
    type: mapType(raw),
    reminder: mapReminder(raw.reminders),
    response: mapResponse(raw),
    startTime,
    endTime,
    duration: Math.round((Date.parse(endTime) - Date.parse(startTime)) / 60000),
    allDay,
    status: mapFreeBusyStatus(raw.transparency),
    location: raw.location ?? null,
    cancelled: raw.status === "cancelled",
    organizerEmail: raw.organizer?.email ?? null,
    deleted: false,
    uid,
    // Google's recurringEventId is the master's own event id, not its iCalUID.
    // Resolving the true iCalUID would take a second API call per instance,
    // so we store Google's id directly as a documented heuristic.
    recurrenceId: raw.recurringEventId ?? null,
    source: ctx.source,
  };
}

function mapSensitivity(visibility: GoogleEvent["visibility"]): Sensitivity {
  switch (visibility) {
    case "private":
      return "private";
    case "confidential":
      return "confidential";
    case "public":
    case "default":
    default:
      return "normal";
  }
}

function mapImportance(raw: GoogleEvent): Importance {
  const override = raw.extendedProperties?.private?.["importance"];
  if (override && (IMPORTANCE_VALUES as readonly string[]).includes(override)) {
    return override as Importance;
  }
  return "normal";
}

function mapOccurrenceType(raw: GoogleEvent): OccurrenceType {
  if (raw.recurringEventId) return "occurrence";
  if (raw.recurrence && raw.recurrence.length > 0) return "series_master";
  return "single";
}

function mapType(raw: GoogleEvent): EventType {
  if (raw.eventType && raw.eventType !== "default") {
    return "other";
  }
  const attendeeCount = raw.attendees?.length ?? 0;
  return attendeeCount > 1 ? "meeting" : "appointment";
}

function mapReminder(reminders: GoogleEvent["reminders"]): boolean {
  if (!reminders) return false;
  return Boolean(reminders.useDefault) || (reminders.overrides?.length ?? 0) > 0;
}

function mapResponse(raw: GoogleEvent): ResponseStatus {
  if (raw.organizer?.self) return "organizer";

  const self = raw.attendees?.find((a) => a.self);
  switch (self?.responseStatus) {
    case "accepted":
      return "accepted";
    case "declined":
      return "declined";
    case "tentative":
      return "tentative";
    case "needsAction":
      return "needs_action";
    default:
      // No attendee list and not marked as organizer: a private event the
      // authenticated user owns outright — treat it as accepted.
      return "accepted";
  }
}

function mapFreeBusyStatus(transparency: GoogleEvent["transparency"]): FreeBusyStatus {
  return transparency === "transparent" ? "free" : "busy";
}

function mapTimes(raw: GoogleEvent): { startTime: string; endTime: string; allDay: boolean } {
  const start = raw.start;
  const end = raw.end;
  if (!start || !end) {
    throw new Error(`Google event ${raw.id ?? "<unknown id>"} is missing start or end`);
  }

  if (start.date && end.date) {
    return {
      startTime: `${start.date}T00:00:00.000Z`,
      endTime: `${end.date}T00:00:00.000Z`,
      allDay: true,
    };
  }

  if (!start.dateTime || !end.dateTime) {
    throw new Error(`Google event ${raw.id ?? "<unknown id>"} has an inconsistent start/end shape`);
  }

  return {
    startTime: new Date(start.dateTime).toISOString(),
    endTime: new Date(end.dateTime).toISOString(),
    allDay: false,
  };
}
