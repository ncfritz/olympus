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
  SENSITIVITY_VALUES,
} from "../../domain/canonicalEvent";
import { RemovalTombstone } from "../calendarProvider";

/** The subset of Microsoft Graph's event resource this mapper reads. Requests must send `Prefer: outlook.timezone="UTC"` so start/end dateTime strings are already UTC (see microsoft-calendar-provider.ts). */
export interface MicrosoftGraphEvent {
  id: string;
  subject?: string;
  importance?: string;
  sensitivity?: string;
  showAs?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  isOrganizer?: boolean;
  isReminderOn?: boolean;
  type?: string;
  seriesMasterId?: string;
  /** Only populated on a series-master resource — never on an occurrence/exception instance. */
  recurrence?: { pattern: unknown; range: unknown };
  start?: { dateTime: string };
  end?: { dateTime: string };
  location?: { displayName?: string };
  organizer?: { emailAddress?: { address?: string } };
  attendees?: unknown[];
  responseStatus?: { response?: string };
  "@removed"?: { reason?: string };
}

/**
 * Delta sync reports removed events as minimal stubs — just `id` and an
 * `@removed` marker, per Graph's documented delta contract — so these must
 * be checked before `mapMicrosoftEventToCanonical`, which needs far more.
 */
export function isMicrosoftRemoval(raw: MicrosoftGraphEvent): boolean {
  return raw["@removed"] !== undefined;
}

/**
 * Unlike Google (whose removal stubs carry only `id`, requiring a heuristic
 * to derive the iCalUID), Graph's `id` is stable and present on every event
 * *and* every removal stub — so this mapper uses it directly as `uid`
 * everywhere instead of `iCalUId`, and removal resolution needs no heuristic.
 */
export function resolveMicrosoftRemoval(
  raw: MicrosoftGraphEvent,
): RemovalTombstone {
  return {
    uid: raw.id,
    // Best-effort like Google's: Graph's delta contract doesn't guarantee
    // `seriesMasterId` survives onto a removal stub, so an occurrence
    // removed from a series may come through indistinguishable from a
    // standalone deletion. The next full resync's diff pass catches it
    // regardless if this guesses wrong.
    isOccurrence: Boolean(raw.seriesMasterId),
  };
}

/**
 * `recurrenceRule` is passed in already-resolved rather than read off `raw`:
 * an expanded calendarView occurrence doesn't carry its series' `recurrence`
 * pattern — only the series-master resource does, which the provider
 * fetches separately (and caches) before calling this. Keeps this mapper a
 * pure, synchronous function like the rest of it.
 */
export function mapMicrosoftEventToCanonical(
  raw: MicrosoftGraphEvent,
  ctx: { source: string },
  recurrenceRule: string | null,
): CanonicalCalendarEvent {
  const { startTime, endTime, allDay } = mapTimes(raw);

  return {
    id: buildCanonicalEventId(ctx.source, raw.id),
    subject: raw.subject ?? "(No title)",
    sensitivity: mapSensitivity(raw.sensitivity),
    importance: mapImportance(raw.importance),
    occurrenceType: mapOccurrenceType(raw.type),
    type: mapType(raw),
    reminder: raw.isReminderOn === true,
    response: mapResponse(raw),
    startTime,
    endTime,
    duration: Math.round((Date.parse(endTime) - Date.parse(startTime)) / 60000),
    allDay,
    status: mapFreeBusyStatus(raw.showAs),
    location: raw.location?.displayName ?? null,
    cancelled: raw.isCancelled === true,
    organizerEmail: raw.organizer?.emailAddress?.address ?? null,
    deleted: false,
    uid: raw.id,
    recurrenceId: raw.seriesMasterId ?? null,
    source: ctx.source,
    recurrenceRule,
  };
}

function mapSensitivity(sensitivity: string | undefined): Sensitivity {
  return sensitivity &&
    (SENSITIVITY_VALUES as readonly string[]).includes(sensitivity)
    ? (sensitivity as Sensitivity)
    : "normal";
}

function mapImportance(importance: string | undefined): Importance {
  return importance &&
    (IMPORTANCE_VALUES as readonly string[]).includes(importance)
    ? (importance as Importance)
    : "normal";
}

function mapOccurrenceType(type: string | undefined): OccurrenceType {
  switch (type) {
    case "occurrence":
    case "exception":
      return "occurrence";
    case "seriesMaster":
      return "series_master";
    case "singleInstance":
    default:
      return "single";
  }
}

function mapType(raw: MicrosoftGraphEvent): EventType {
  // Graph has no direct equivalent of Google's eventType (out-of-office,
  // focus time, ...), so this is a documented heuristic like Google's: an
  // event with at least one attendee besides the organizer is a meeting.
  return (raw.attendees?.length ?? 0) > 0 ? "meeting" : "appointment";
}

function mapResponse(raw: MicrosoftGraphEvent): ResponseStatus {
  if (raw.isOrganizer) return "organizer";

  switch (raw.responseStatus?.response) {
    case "accepted":
      return "accepted";
    case "declined":
      return "declined";
    case "tentativelyAccepted":
      return "tentative";
    case "notResponded":
      return "needs_action";
    case "none":
    default:
      // No response tracked and not the organizer: treat as accepted, same
      // default Google's mapper uses for an owned event with no attendees.
      return "accepted";
  }
}

function mapFreeBusyStatus(showAs: string | undefined): FreeBusyStatus {
  switch (showAs) {
    case "free":
      return "free";
    case "tentative":
      return "tentative";
    case "oof":
      return "out_of_office";
    case "workingElsewhere":
      return "working_elsewhere";
    case "busy":
    case "unknown":
    default:
      return "busy";
  }
}

function mapTimes(raw: MicrosoftGraphEvent): {
  startTime: string;
  endTime: string;
  allDay: boolean;
} {
  const start = raw.start;
  const end = raw.end;
  if (!start?.dateTime || !end?.dateTime) {
    throw new Error(`Microsoft event ${raw.id} is missing start or end`);
  }

  if (raw.isAllDay) {
    return {
      startTime: `${start.dateTime.slice(0, 10)}T00:00:00.000Z`,
      endTime: `${end.dateTime.slice(0, 10)}T00:00:00.000Z`,
      allDay: true,
    };
  }

  // Requests set `Prefer: outlook.timezone="UTC"`, so these dateTime strings
  // (e.g. "2024-01-01T10:00:00.0000000") are already UTC but carry no "Z" —
  // Graph's own convention for its "timeZone": "UTC" responses.
  return {
    startTime: new Date(`${start.dateTime}Z`).toISOString(),
    endTime: new Date(`${end.dateTime}Z`).toISOString(),
    allDay: false,
  };
}
