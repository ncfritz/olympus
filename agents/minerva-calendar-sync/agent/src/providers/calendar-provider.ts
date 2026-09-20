import { CanonicalCalendarEvent } from "../domain/canonical-event";

export interface ProviderCalendar {
  id: string;
  summary: string;
  /** True for the account's own primary calendar — Google reports it under its real id (the account email), not the "primary" alias SyncedCalendarConfig accepts as a shorthand for it. */
  primary: boolean;
}

/**
 * The bounded date range a full sync fetches events within — see
 * SyncEngine's window computation. Both providers ask the remote API to
 * expand recurring series into individually-dated occurrences (Google's
 * `singleEvents: true`, Microsoft's `/calendarView`), and that expansion is
 * only ever done over a bounded range — there's no "expand forever" mode.
 */
export interface SyncWindow {
  /** ISO-8601, inclusive. */
  start: string;
  /** ISO-8601, exclusive. */
  end: string;
}

/** One page of raw, provider-native events from a full (from-scratch) sync. */
export interface RawEventBatch {
  events: unknown[];
  nextPageToken?: string;
  /** Only present on the final page — persist it as the incremental sync cursor. */
  nextSyncToken?: string;
}

export interface IncrementalResult {
  events: unknown[];
  nextSyncToken: string;
}

/**
 * Thrown by `incrementalSync` when the stored sync token has expired or is
 * otherwise no longer valid (e.g. Google's 410 Gone). Callers should clear
 * the persisted token and fall back to `fullSync`.
 */
export class SyncTokenExpiredError extends Error {
  constructor(calendarId: string, cause?: unknown) {
    super(`Sync token expired for calendar "${calendarId}"`, { cause });
    this.name = "SyncTokenExpiredError";
  }
}

export interface PushChannel {
  id: string;
  resourceId: string;
  /** ISO-8601. */
  expiration: string;
}

/** Resolved identity for a raw event that represents a removal (see `isRemoval`). */
export interface RemovalTombstone {
  uid: string;
  /**
   * True when only one occurrence of a recurring series was called off (the
   * series itself continues) — callers should soft-cancel, not delete.
   * False for a standalone event or an entire series being removed.
   */
  isOccurrence: boolean;
}

/**
 * Talks to one calendar backend (Google today, Office 365 later). SyncEngine
 * depends only on this interface, never on a concrete provider.
 */
export interface CalendarProvider {
  readonly id: string;

  listCalendars(): Promise<ProviderCalendar[]>;

  /** Pages through every event (recurring series expanded into their individual occurrences) within `window`, for a from-scratch sync. */
  fullSync(calendarId: string, window: SyncWindow): AsyncIterable<RawEventBatch>;

  /** Fetches everything changed since `syncToken`, within whatever window was active when that token was issued. Throws SyncTokenExpiredError if it's stale. */
  incrementalSync(calendarId: string, syncToken: string): Promise<IncrementalResult>;

  /**
   * Converts one provider-native raw event into the canonical shape.
   * Async because a plain recurring occurrence doesn't carry its series'
   * recurrence rule inline — capturing it (for CanonicalCalendarEvent.recurrenceRule)
   * takes a separate lookup of the series-master event. `calendarId` is
   * here (alongside `source`, already used for tagging) because that
   * lookup needs it.
   */
  normalizeEvent(raw: unknown, ctx: { source: string; calendarId: string }): Promise<CanonicalCalendarEvent>;

  /**
   * True when `raw` is a minimal removal record, as incremental/delta sync
   * APIs return for deleted events (often little more than an id and a
   * status flag) — too little data for `normalizeEvent`. Callers must check
   * this before calling `normalizeEvent` and use `resolveRemoval` instead.
   */
  isRemoval(raw: unknown): boolean;

  /** Resolves identity for a raw event that `isRemoval` returned true for. */
  resolveRemoval(raw: unknown): RemovalTombstone;

  supportsPush(): boolean;
  /** `token` is an opaque secret the caller generates and later verifies against each incoming notification, to reject forged ones. */
  watch?(calendarId: string, webhookUrl: string, token: string): Promise<PushChannel>;
  stopWatch?(channel: PushChannel): Promise<void>;
}
