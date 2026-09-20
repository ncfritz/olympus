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
  /**
   * 20. The provider's own recurrence description for this event's series,
   * if any — RFC5545 RRULE/EXDATE lines (newline-joined) for Google, a
   * JSON-serialized Graph `recurrence` pattern for Microsoft. Recorded for
   * reference/debugging only: this app never parses or expands it itself,
   * since it syncs already-expanded per-occurrence events from the provider
   * (see CalendarProvider.fullSync's SyncWindow).
   */
  recurrenceRule: string | null;
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
  /** When this row was last written — i.e. when a full or incremental sync last completed. Absent when constructing a state to save (the store stamps it). */
  lastSyncedAt?: string;
  /**
   * When a *full* sync last completed — distinct from lastSyncedAt, which
   * also updates on every incremental sync. SyncEngine uses this to decide
   * when the bounded sync window (see CalendarProvider.fullSync) has gone
   * stale and needs re-establishing with a fresh window, since an
   * incremental sync's token keeps whatever window was active when it was
   * issued and never rolls it forward on its own.
   */
  lastFullSyncAt: string | null;
}
