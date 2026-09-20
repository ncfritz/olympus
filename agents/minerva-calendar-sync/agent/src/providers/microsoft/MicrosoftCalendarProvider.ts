import { CanonicalCalendarEvent } from "../../domain/canonicalEvent";
import {
  CalendarProvider,
  IncrementalResult,
  ProviderCalendar,
  PushChannel,
  RawEventBatch,
  RemovalTombstone,
  SyncWindow,
} from "../calendarProvider";
import { SyncTokenExpiredError } from "../SyncTokenExpiredError";
import {
  isMicrosoftRemoval,
  mapMicrosoftEventToCanonical,
  MicrosoftGraphEvent,
  resolveMicrosoftRemoval,
} from "./microsoftEventMapper";
import { MicrosoftAccessTokenProvider } from "./microsoftOauth";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const PAGE_SIZE = 250;
// Graph's own max subscription lifetime for the /events resource is ~4230
// minutes (just under 3 days) — request a hair under that as a safety margin.
const SUBSCRIPTION_TTL_MS = 3 * 24 * 60 * 60 * 1000 - 10 * 60 * 1000;
// See GoogleCalendarProvider's identical constant for the reasoning.
const RECURRENCE_RULE_CACHE_TTL_MS = 10 * 60_000;

interface CachedRecurrenceRule {
  value: Promise<string | null>;
  expiresAt: number;
}

interface GraphCalendarListResponse {
  value: Array<{ id: string; name?: string; isDefaultCalendar?: boolean }>;
  "@odata.nextLink"?: string;
}

interface GraphEventDeltaResponse {
  value: MicrosoftGraphEvent[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

interface GraphSubscriptionResponse {
  id: string;
  resource: string;
  expirationDateTime: string;
}

class GraphRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GraphRequestError";
  }
}

export class MicrosoftCalendarProvider implements CalendarProvider {
  readonly id = "microsoft";
  private readonly recurrenceRuleCache = new Map<
    string,
    CachedRecurrenceRule
  >();

  constructor(private readonly auth: MicrosoftAccessTokenProvider) {}

  async listCalendars(): Promise<ProviderCalendar[]> {
    const calendars: ProviderCalendar[] = [];
    let url: string | undefined =
      `${GRAPH_BASE}/me/calendars?$top=${PAGE_SIZE}`;

    while (url) {
      const data: GraphCalendarListResponse = await this.request(url);
      for (const item of data.value) {
        calendars.push({
          id: item.id,
          summary: item.name ?? item.id,
          primary: item.isDefaultCalendar === true,
        });
      }
      url = data["@odata.nextLink"];
    }

    return calendars;
  }

  async *fullSync(
    calendarId: string,
    window: SyncWindow,
  ): AsyncIterable<RawEventBatch> {
    let url: string | undefined = this.deltaUrl(calendarId, window);

    while (url) {
      const data: GraphEventDeltaResponse = await this.request(url);
      url = data["@odata.nextLink"];
      yield {
        events: data.value,
        nextPageToken: url,
        // Only present on the final page, same contract as Google's nextSyncToken.
        nextSyncToken: url ? undefined : data["@odata.deltaLink"],
      };
    }
  }

  async incrementalSync(
    calendarId: string,
    syncToken: string,
  ): Promise<IncrementalResult> {
    const events: MicrosoftGraphEvent[] = [];
    let url: string | undefined = syncToken;
    let deltaLink: string | undefined;

    while (url) {
      let data: GraphEventDeltaResponse;
      try {
        data = await this.request(url);
      } catch (error) {
        if (isGone(error)) {
          throw new SyncTokenExpiredError(calendarId, error);
        }
        throw error;
      }

      events.push(...data.value);
      url = data["@odata.nextLink"];
      deltaLink = data["@odata.deltaLink"] ?? deltaLink;
    }

    if (!deltaLink) {
      throw new Error(
        `Microsoft incrementalSync for "${calendarId}" did not return a deltaLink`,
      );
    }

    return { events, nextSyncToken: deltaLink };
  }

  async normalizeEvent(
    raw: unknown,
    ctx: { source: string; calendarId: string },
  ): Promise<CanonicalCalendarEvent> {
    const event = raw as MicrosoftGraphEvent;
    const recurrenceRule = event.seriesMasterId
      ? await this.getRecurrenceRule(event.seriesMasterId)
      : event.recurrence
        ? JSON.stringify(event.recurrence)
        : null;
    return mapMicrosoftEventToCanonical(event, ctx, recurrenceRule);
  }

  /**
   * An expanded calendarView occurrence doesn't carry its series'
   * `recurrence` pattern — only the master resource does — so this fetches
   * it directly. `/me/events/{id}` addresses an event by id regardless of
   * which calendar folder it's actually in, so no calendarId is needed here.
   * Cached like Google's equivalent lookup, for the same reason.
   */
  private getRecurrenceRule(masterEventId: string): Promise<string | null> {
    const cached = this.recurrenceRuleCache.get(masterEventId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = this.request<MicrosoftGraphEvent>(
      `${GRAPH_BASE}/me/events/${masterEventId}`,
    )
      .then((master) =>
        master.recurrence ? JSON.stringify(master.recurrence) : null,
      )
      .catch(() => null);
    this.recurrenceRuleCache.set(masterEventId, {
      value,
      expiresAt: Date.now() + RECURRENCE_RULE_CACHE_TTL_MS,
    });
    return value;
  }

  isRemoval(raw: unknown): boolean {
    return isMicrosoftRemoval(raw as MicrosoftGraphEvent);
  }

  resolveRemoval(raw: unknown): RemovalTombstone {
    return resolveMicrosoftRemoval(raw as MicrosoftGraphEvent);
  }

  supportsPush(): boolean {
    return true;
  }

  async watch(
    calendarId: string,
    webhookUrl: string,
    token: string,
  ): Promise<PushChannel> {
    const data = await this.request<GraphSubscriptionResponse>(
      `${GRAPH_BASE}/subscriptions`,
      {
        method: "POST",
        body: JSON.stringify({
          changeType: "created,updated,deleted",
          notificationUrl: webhookUrl,
          resource: this.eventsResource(calendarId),
          expirationDateTime: new Date(
            Date.now() + SUBSCRIPTION_TTL_MS,
          ).toISOString(),
          clientState: token,
        }),
      },
    );

    return {
      id: data.id,
      resourceId: data.resource,
      expiration: data.expirationDateTime,
    };
  }

  async stopWatch(channel: PushChannel): Promise<void> {
    await this.request(`${GRAPH_BASE}/subscriptions/${channel.id}`, {
      method: "DELETE",
    });
  }

  /**
   * `/calendarView/delta` (not `/events/delta`) is what makes Graph expand
   * recurring series into individually-dated occurrences instead of
   * returning one series-master resource per series — the startDateTime/
   * endDateTime bounds are required for it and, like Google's sync token,
   * get baked into the returned deltaLink for every later incremental call.
   */
  private deltaUrl(calendarId: string, window: SyncWindow): string {
    // Unlike a plain collection endpoint, delta/change-tracking queries
    // reject $top outright (400 ErrorInvalidUrlQuery) — page size is instead
    // requested via the Prefer: odata.maxpagesize= header (see request()),
    // which every subsequent @odata.nextLink/@odata.deltaLink-driven call
    // must keep resending since it's a header, not part of the URL.
    const params = new URLSearchParams({
      startDateTime: window.start,
      endDateTime: window.end,
    });
    return `${GRAPH_BASE}/${this.calendarViewResource(calendarId)}/delta?${params}`;
  }

  private calendarViewResource(calendarId: string): string {
    // SyncedCalendarConfig accepts "primary" as a shorthand for the account's default calendar.
    return calendarId === "primary"
      ? "me/calendarView"
      : `me/calendars/${calendarId}/calendarView`;
  }

  private eventsResource(calendarId: string): string {
    // SyncedCalendarConfig accepts "primary" as a shorthand for the account's default calendar.
    return calendarId === "primary"
      ? "me/events"
      : `me/calendars/${calendarId}/events`;
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const accessToken = await this.auth.getAccessToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        // outlook.timezone: see microsoft-event-mapper.ts's UTC assumption.
        // odata.maxpagesize: the only way to request a page size on a delta
        // query (see deltaUrl()) — sent unconditionally since other Graph
        // endpoints just ignore Prefer directives they don't recognize.
        Prefer: `outlook.timezone="UTC", odata.maxpagesize=${PAGE_SIZE}`,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new GraphRequestError(
        response.status,
        `Microsoft Graph request to ${url} failed (${response.status}): ${body}`,
      );
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }
}

function isGone(error: unknown): boolean {
  return error instanceof GraphRequestError && error.status === 410;
}
