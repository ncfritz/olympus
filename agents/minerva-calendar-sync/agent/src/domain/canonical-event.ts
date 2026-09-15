/**
 * Categorical value sets. Kept as string literal unions (not native DB enums)
 * so the same values work unchanged across every EventStore backend
 * (SQLite, Postgres, or a custom API) and every CalendarProvider.
 */
export const SENSITIVITY_VALUES = ["normal", "personal", "private", "confidential"] as const;
export type Sensitivity = (typeof SENSITIVITY_VALUES)[number];

export const IMPORTANCE_VALUES = ["low", "normal", "high"] as const;
export type Importance = (typeof IMPORTANCE_VALUES)[number];

export const OCCURRENCE_TYPE_VALUES = ["single", "occurrence", "series_master"] as const;
export type OccurrenceType = (typeof OCCURRENCE_TYPE_VALUES)[number];

export const EVENT_TYPE_VALUES = ["appointment", "meeting", "other"] as const;
export type EventType = (typeof EVENT_TYPE_VALUES)[number];

export const RESPONSE_VALUES = [
  "organizer",
  "accepted",
  "declined",
  "tentative",
  "needs_action",
] as const;
export type ResponseStatus = (typeof RESPONSE_VALUES)[number];

export const FREE_BUSY_STATUS_VALUES = [
  "free",
  "busy",
  "tentative",
  "out_of_office",
  "working_elsewhere",
] as const;
export type FreeBusyStatus = (typeof FREE_BUSY_STATUS_VALUES)[number];

/**
 * The provider-agnostic event record persisted by every EventStore
 * implementation. Field numbering in comments matches the original spec.
 */
export interface CanonicalCalendarEvent {
  /** 1. Stable internal id — see `buildCanonicalEventId`. */
  id: string;
  /** 2. */
  subject: string;
  /** 3a. */
  sensitivity: Sensitivity;
  /** 3b. */
  importance: Importance;
  /** 4. */
  occurrenceType: OccurrenceType;
  /** 5. */
  type: EventType;
  /** 6. */
  reminder: boolean;
  /** 7. */
  response: ResponseStatus;
  /** 8. ISO-8601. */
  startTime: string;
  /** 9. ISO-8601. */
  endTime: string;
  /** 10. Minutes. */
  duration: number;
  /** 11. */
  allDay: boolean;
  /** 12. Free/busy status. */
  status: FreeBusyStatus;
  /** 13. */
  location: string | null;
  /** 14. */
  cancelled: boolean;
  /** 15. */
  organizerEmail: string | null;
  /** 16. Soft-delete flag — set by the sync engine, not the provider. */
  deleted: boolean;
  /** 17. Stable cross-system identifier (e.g. Google's iCalUID). */
  uid: string;
  /** 18. Points at the series-master event's `uid`, if any. */
  recurrenceId: string | null;
  /** 19. The configured calendar/account label this event came from. */
  source: string;
}

/** `source` and `uid` already guarantee uniqueness, so the id is just their composite — no hash needed. */
export function buildCanonicalEventId(source: string, uid: string): string {
  return `${source}:${uid}`;
}

export interface EventFilter {
  source?: string;
  startsAfter?: string;
  startsBefore?: string;
  cancelled?: boolean;
  deleted?: boolean;
  occurrenceType?: OccurrenceType;
  limit?: number;
  cursor?: string;
}

/** Per-calendar incremental sync cursor + push-channel bookkeeping. */
export interface SyncState {
  calendarId: string;
  syncToken: string | null;
  channelId: string | null;
  resourceId: string | null;
  channelExpiration: string | null;
  /** Shared secret echoed back on every push notification for that channel, to reject forged requests. */
  channelToken: string | null;
}
