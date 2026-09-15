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
} from "../calendar-provider";
import { isGoogleRemoval, mapGoogleEventToCanonical, resolveGoogleRemoval } from "./google-event-mapper";

const PAGE_SIZE = 250;

export class GoogleCalendarProvider implements CalendarProvider {
  readonly id = "google";
  private readonly calendar: calendar_v3.Calendar;

  constructor(auth: OAuth2Client) {
    this.calendar = google.calendar({ version: "v3", auth });
  }

  async listCalendars(): Promise<ProviderCalendar[]> {
    const calendars: ProviderCalendar[] = [];
    let pageToken: string | undefined;

    do {
      const { data } = await this.calendar.calendarList.list({ pageToken });
      for (const item of data.items ?? []) {
        if (item.id) calendars.push({ id: item.id, summary: item.summary ?? item.id });
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);

    return calendars;
  }

  async *fullSync(calendarId: string): AsyncIterable<RawEventBatch> {
    let pageToken: string | undefined;

    do {
      const { data } = await this.calendar.events.list({
        calendarId,
        singleEvents: false,
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

  async incrementalSync(calendarId: string, syncToken: string): Promise<IncrementalResult> {
    const events: unknown[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    do {
      let data: calendar_v3.Schema$Events;
      try {
        ({ data } = await this.calendar.events.list({
          calendarId,
          singleEvents: false,
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
      throw new Error(`Google incrementalSync for "${calendarId}" did not return a nextSyncToken`);
    }

    return { events, nextSyncToken };
  }

  normalizeEvent(raw: unknown, ctx: { source: string }): CanonicalCalendarEvent {
    return mapGoogleEventToCanonical(raw as calendar_v3.Schema$Event, ctx);
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

  async watch(calendarId: string, webhookUrl: string, token: string): Promise<PushChannel> {
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
      throw new Error(`Google watch() for "${calendarId}" returned an incomplete channel`);
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
    (error as { code?: number; response?: { status?: number } })?.response?.status ??
    (error as { code?: number })?.code;
  return status === 410;
}
