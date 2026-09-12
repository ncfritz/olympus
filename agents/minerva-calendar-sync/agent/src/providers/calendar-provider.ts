import { CanonicalCalendarEvent } from "../domain/canonical-event";

export interface ProviderCalendar {
  id: string;
  summary: string;
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

/**
 * Talks to one calendar backend (Google today, Office 365 later). SyncEngine
 * depends only on this interface, never on a concrete provider.
 */
export interface CalendarProvider {
  readonly id: string;

  listCalendars(): Promise<ProviderCalendar[]>;

  /** Pages through every event currently on the calendar, for a from-scratch sync. */
  fullSync(calendarId: string): AsyncIterable<RawEventBatch>;

  /** Fetches everything changed since `syncToken`. Throws SyncTokenExpiredError if it's stale. */
  incrementalSync(calendarId: string, syncToken: string): Promise<IncrementalResult>;

  /** Converts one provider-native raw event into the canonical shape. */
  normalizeEvent(raw: unknown, ctx: { source: string }): CanonicalCalendarEvent;

  supportsPush(): boolean;
  watch?(calendarId: string, webhookUrl: string): Promise<PushChannel>;
  stopWatch?(channel: PushChannel): Promise<void>;
}
