import { randomUUID } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { calendar_v3, google } from "googleapis";
import { CanonicalCalendarEvent } from "../../domain/canonical-event";
import {
  CalendarProvider,
  IncrementalResult,
  ProviderCalendar,
  PushChannel,
  RawEventBatch,
  RemovalTombstone,
  SyncTokenExpiredError,
  SyncWindow,
} from "../calendar-provider";
import {
  isGoogleRemoval,
  mapGoogleEventToCanonical,
  resolveGoogleRemoval,
} from "./google-event-mapper";

const PAGE_SIZE = 250;
// How long a resolved series recurrence rule is trusted before re-fetching
// the master — bounds staleness if a series' recurrence is edited mid-sync
// without needing to coordinate a cache reset against concurrent syncs of
// other calendars under the same account (providers are cached per account,
// see CalendarProviderRegistry).
const RECURRENCE_RULE_CACHE_TTL_MS = 10 * 60_000;

interface CachedRecurrenceRule {
  value: Promise<string | null>;
  expiresAt: number;
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly id = "google";
  private readonly calendar: calendar_v3.Calendar;
  private readonly recurrenceRuleCache = new Map<
    string,
    CachedRecurrenceRule
  >();

  constructor(auth: OAuth2Client) {
    this.calendar = google.calendar({ version: "v3", auth });
  }

  async listCalendars(): Promise<ProviderCalendar[]> {
    const calendars: ProviderCalendar[] = [];
    let pageToken: string | undefined;

    do {
      const { data } = await this.calendar.calendarList.list({ pageToken });
      for (const item of data.items ?? []) {
        if (item.id)
          calendars.push({
            id: item.id,
            summary: item.summary ?? item.id,
            primary: item.primary === true,
          });
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);

    return calendars;
  }

  async *fullSync(
    calendarId: string,
    window: SyncWindow,
  ): AsyncIterable<RawEventBatch> {
    let pageToken: string | undefined;

    do {
      const { data } = await this.calendar.events.list({
        calendarId,
        // Expands recurring series into individually-dated occurrences
        // instead of one series-master row per series. Deliberately no
        // `orderBy` — it's tempting to add "startTime" alongside
        // singleEvents (Google only allows that combination), but doing so
        // silently drops nextSyncToken from the response entirely, even on
        // the last page — verified directly against the live API, not just
        // documentation. Storage order doesn't depend on fetch order here
        // (EventStore does its own ORDER BY), so there's nothing to trade
        // the sync token away for.
        singleEvents: true,
        timeMin: window.start,
        timeMax: window.end,
        maxResults: PAGE_SIZE,
        pageToken,
      });

      pageToken = data.nextPageToken ?? undefined;
      yield {
        events: data.items ?? [],
        nextPageToken: pageToken,
        nextSyncToken: data.nextSyncToken ?? undefined,
      };
    } while (pageToken);
  }

  async incrementalSync(
    calendarId: string,
    syncToken: string,
  ): Promise<IncrementalResult> {
    const events: unknown[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    do {
      let data: calendar_v3.Schema$Events;
      try {
        // Google rejects timeMin/timeMax/orderBy alongside a syncToken — the
        // token itself remembers the window it was issued for. singleEvents
        // must still match the mode that window was established with.
        ({ data } = await this.calendar.events.list({
          calendarId,
          singleEvents: true,
          syncToken,
          pageToken,
        }));
      } catch (error) {
        if (isGone(error)) {
          throw new SyncTokenExpiredError(calendarId, error);
        }
        throw error;
      }

      events.push(...(data.items ?? []));
      pageToken = data.nextPageToken ?? undefined;
      nextSyncToken = data.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    if (!nextSyncToken) {
      throw new Error(
        `Google incrementalSync for "${calendarId}" did not return a nextSyncToken`,
      );
    }

    return { events, nextSyncToken };
  }

  async normalizeEvent(
    raw: unknown,
    ctx: { source: string; calendarId: string },
  ): Promise<CanonicalCalendarEvent> {
    const event = raw as calendar_v3.Schema$Event;
    const recurrenceRule = event.recurringEventId
      ? await this.getRecurrenceRule(ctx.calendarId, event.recurringEventId)
      : (event.recurrence?.join("\n") ?? null);
    return mapGoogleEventToCanonical(event, ctx, recurrenceRule);
  }

  /**
   * A plain occurrence (singleEvents: true) doesn't carry its series'
   * `recurrence` field — only the master resource does — so this fetches the
   * master directly. Cached (with a short TTL, see RECURRENCE_RULE_CACHE_TTL_MS)
   * so a series with many occurrences in the sync window costs one extra
   * request per series, not one per occurrence. Best-effort: a failed lookup
   * (e.g. the master itself is somehow gone) yields null rather than failing
   * the whole sync over a field that's purely informational.
   */
  private getRecurrenceRule(
    calendarId: string,
    masterEventId: string,
  ): Promise<string | null> {
    const cacheKey = `${calendarId}:${masterEventId}`;
    const cached = this.recurrenceRuleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = this.calendar.events
      .get({ calendarId, eventId: masterEventId })
      .then(({ data }) => data.recurrence?.join("\n") ?? null)
      .catch(() => null);
    this.recurrenceRuleCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + RECURRENCE_RULE_CACHE_TTL_MS,
    });
    return value;
  }

  isRemoval(raw: unknown): boolean {
    return isGoogleRemoval(raw as calendar_v3.Schema$Event);
  }

  resolveRemoval(raw: unknown): RemovalTombstone {
    return resolveGoogleRemoval(raw as calendar_v3.Schema$Event);
  }

  supportsPush(): boolean {
    return true;
  }

  async watch(
    calendarId: string,
    webhookUrl: string,
    token: string,
  ): Promise<PushChannel> {
    const { data } = await this.calendar.events.watch({
      calendarId,
      requestBody: {
        id: randomUUID(),
        type: "web_hook",
        address: webhookUrl,
        token,
      },
    });

    if (!data.id || !data.resourceId || !data.expiration) {
      throw new Error(
        `Google watch() for "${calendarId}" returned an incomplete channel`,
      );
    }

    return {
      id: data.id,
      resourceId: data.resourceId,
      // Google returns this as a string of milliseconds since epoch.
      expiration: new Date(Number(data.expiration)).toISOString(),
    };
  }

  async stopWatch(channel: PushChannel): Promise<void> {
    await this.calendar.channels.stop({
      requestBody: { id: channel.id, resourceId: channel.resourceId },
    });
  }
}

function isGone(error: unknown): boolean {
  const status =
    (error as { code?: number; response?: { status?: number } })?.response
      ?.status ?? (error as { code?: number })?.code;
  return status === 410;
}
