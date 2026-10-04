import { apiClient } from "./client";
import {
  type AvailabilityBlock,
  type AvailabilityLevel,
  clearMeetingAvailability,
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  getAvailability,
  listAvailabilityBlocks,
  listMeetingAvailabilities,
  setMeetingAvailability,
  updateAvailabilityBlock,
} from "./olympus";
import type { components } from "../../generated/api";

export type EventDto = components["schemas"]["Event"];
export type CalendarStatus = components["schemas"]["Calendar"];
/** The signed-in user's availability is Olympus's (ADR 0029), in its words. */
export type AvailabilityStatus = AvailabilityLevel;
export type FreeBusyStatus = EventDto["status"];
/** A level the user set for one of their meetings. */
export interface EventOverrideDto {
  eventId: string;
  status: AvailabilityStatus;
}
export type OverrideBlockDto = AvailabilityBlock;
export type CalendarAccountStatus = components["schemas"]["CalendarAccount"];
export type AvailableCalendar = components["schemas"]["AvailableCalendar"];
export type SyncRun = components["schemas"]["SyncRun"];
export type SyncRunDetail = components["schemas"]["FullSyncRun"];
export type SyncRunEventChange = components["schemas"]["SyncRunEventChange"];
export type SyncRunDailyStat = components["schemas"]["SyncRunDailyStat"];
export type OutboxSummary = components["schemas"]["OutboxSummary"];
export type OutboxSourceStats = components["schemas"]["OutboxSourceSummary"];
export type OutboxRecord = components["schemas"]["OutboxEvent"];
export type EventPublishStatus = components["schemas"]["EventPublishStatus"];
export type BackfillResult = components["schemas"]["CalendarBackfill"];

/** Keyed by each 15-minute chunk's start time, in minutes since epoch (as a string, since JSON object keys always are). */
export type StatusTimeline = Record<string, AvailabilityStatus>;

export async function fetchCalendars(): Promise<CalendarStatus[]> {
  const { data } = await apiClient.GET("/v1/calendars");
  return data?.calendars ?? [];
}

export async function fetchCalendarColors(): Promise<Record<string, string>> {
  const { data } = await apiClient.GET("/v1/calendar-colors");
  return data?.calendarColors ?? {};
}

export async function setCalendarColor(
  source: string,
  color: string,
): Promise<void> {
  const { error } = await apiClient.PUT("/v1/calendar-color/{source}", {
    params: { path: { source } },
    body: { calendarColor: { color } },
  });
  if (error)
    throw new Error(`Failed to set calendar color: ${JSON.stringify(error)}`);
}

export async function triggerCalendarSync(
  calendarId: string,
): Promise<boolean> {
  const { response } = await apiClient.POST("/v1/calendar/{calendarId}/sync", {
    params: { path: { calendarId } },
  });
  return response.ok;
}

export async function setCalendarEnabled(
  calendarId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await apiClient.PUT("/v1/calendar/{calendarId}", {
    params: { path: { calendarId } },
    body: { calendar: { enabled } },
  });
  if (error)
    throw new Error(`Failed to set calendar enabled: ${JSON.stringify(error)}`);
}

export async function setCalendarIncludedInBusy(
  calendarId: string,
  includedInBusy: boolean,
): Promise<void> {
  const { error } = await apiClient.PUT("/v1/calendar/{calendarId}", {
    params: { path: { calendarId } },
    body: { calendar: { includedInBusy } },
  });
  if (error)
    throw new Error(
      `Failed to set calendar busy inclusion: ${JSON.stringify(error)}`,
    );
}

export async function addCalendar(calendar: {
  provider: "google" | "microsoft";
  accountLabel: string;
  calendarId: string;
  source: string;
}): Promise<CalendarStatus> {
  const { data, error } = await apiClient.POST("/v1/calendars", {
    body: { calendar },
  });
  if (error || !data)
    throw new Error(`Failed to add calendar: ${JSON.stringify(error)}`);
  return data.calendar;
}

export async function removeCalendar(calendarId: string): Promise<void> {
  const { error } = await apiClient.DELETE("/v1/calendar/{calendarId}", {
    params: { path: { calendarId } },
  });
  if (error)
    throw new Error(`Failed to remove calendar: ${JSON.stringify(error)}`);
}

export async function fetchAvailableCalendars(
  accountLabel: string,
  provider: "google" | "microsoft",
): Promise<AvailableCalendar[]> {
  const { data } = await apiClient.GET(
    "/v1/calendar-account/{accountLabel}/calendars",
    { params: { path: { accountLabel }, query: { provider } } },
  );
  return data?.availableCalendars ?? [];
}

export async function fetchCalendarAccountStatuses(): Promise<
  CalendarAccountStatus[]
> {
  const { data } = await apiClient.GET("/v1/calendar-accounts");
  return data?.calendarAccounts ?? [];
}

export interface SyncRunFilterParams {
  calendarId?: string;
  type?: SyncRun["type"];
  trigger?: SyncRun["trigger"];
  status?: SyncRun["status"];
}

export async function fetchSyncRuns(
  filter: SyncRunFilterParams & { limit?: number },
): Promise<SyncRun[]> {
  const { data } = await apiClient.GET("/v1/sync-runs", {
    params: { query: filter },
  });
  return data?.syncRuns ?? [];
}

export async function fetchSyncRun(id: string): Promise<SyncRunDetail | null> {
  const { data } = await apiClient.GET("/v1/sync-run/{syncRunId}", {
    params: { path: { syncRunId: id } },
  });
  return data?.syncRun ?? null;
}

export async function fetchSyncRunStats(
  filter: SyncRunFilterParams & { days?: number },
): Promise<SyncRunDailyStat[]> {
  const { data } = await apiClient.GET("/v1/sync-runs/stats", {
    params: { query: filter },
  });
  return data?.syncRunStats ?? [];
}

/** Starts a new device-flow login for a calendar-sync account; returns the URL to open so the user can complete it. */
export async function startCalendarAccountReauth(
  accountLabel: string,
  provider: "google" | "microsoft",
): Promise<string> {
  const { data, error } = await apiClient.POST(
    "/v1/calendar-account/{accountLabel}/reauthorize",
    { params: { path: { accountLabel }, query: { provider } } },
  );
  if (error || !data)
    throw new Error(`Failed to start reauth: ${JSON.stringify(error)}`);
  return data.reauthorization.authUrl;
}

export type NewAccountAuthStatus =
  components["schemas"]["CalendarAccountAuthorization"];

/** Starts authorizing a brand-new account for the given provider; returns an id to poll and the URL to open to complete it. */
export async function startNewAccountAuth(
  provider: "google" | "microsoft",
): Promise<{ transactionId: string; authUrl: string }> {
  const { data, error } = await apiClient.POST(
    "/v1/calendar-account-authorizations",
    { body: { calendarAccountAuthorization: { provider } } },
  );
  if (error || !data)
    throw new Error(`Failed to start authorization: ${JSON.stringify(error)}`);
  const { authorizationId, authUrl } = data.calendarAccountAuthorization;
  return { transactionId: authorizationId, authUrl: authUrl ?? "" };
}

export async function fetchNewAccountAuthStatus(
  transactionId: string,
): Promise<NewAccountAuthStatus> {
  const { data, error } = await apiClient.GET(
    "/v1/calendar-account-authorization/{authorizationId}",
    { params: { path: { authorizationId: transactionId } } },
  );
  if (error || !data)
    throw new Error(
      `Failed to check authorization status: ${JSON.stringify(error)}`,
    );
  return data.calendarAccountAuthorization;
}

export interface EventFilters {
  showCancelled: boolean;
  showDeleted: boolean;
  limit: number;
  /** ISO-8601. Scopes the fetch to the calendar's currently-visible date range — omitted in List view, which browses everything by recency instead. */
  startsAfter?: string;
  startsBefore?: string;
}

export async function fetchEvents(filters: EventFilters): Promise<EventDto[]> {
  const { data } = await apiClient.GET("/v1/events", {
    params: {
      query: {
        cancelled: filters.showCancelled ? undefined : false,
        deleted: filters.showDeleted ? undefined : false,
        limit: filters.limit,
        startsAfter: filters.startsAfter,
        startsBefore: filters.startsBefore,
      },
    },
  });
  return data?.events ?? [];
}

/*
 * Availability: the signed-in user's, from the Olympus API through the
 * agent (ADR 0029). Only the user's own meetings have a level; an event of
 * an account that is not theirs has none, and setting one is not found.
 */

/** The API's longest range, in milliseconds (92 days). */
const MAX_RANGE_MS = 92 * 24 * 60 * 60 * 1000;

/** How many meetings one lookup names: their IDs ride in the query string. */
const MEETING_IDS_PER_REQUEST = 25;

/** [start, end) in pieces the API will take. */
function rangeChunks(
  start: string,
  end: string,
): { start: string; end: string }[] {
  const chunks: { start: string; end: string }[] = [];
  const last = Date.parse(end);
  for (let from = Date.parse(start); from < last; from += MAX_RANGE_MS) {
    chunks.push({
      start: new Date(from).toISOString(),
      end: new Date(Math.min(from + MAX_RANGE_MS, last)).toISOString(),
    });
  }
  return chunks;
}

/** The levels the user set for these events — those of their meetings that have one. */
export async function fetchEventOverrides(
  eventIds: string[],
): Promise<EventOverrideDto[]> {
  const pages: string[][] = [];
  for (let i = 0; i < eventIds.length; i += MEETING_IDS_PER_REQUEST) {
    pages.push(eventIds.slice(i, i + MEETING_IDS_PER_REQUEST));
  }
  const answers = await Promise.all(
    pages.map((ids) =>
      listMeetingAvailabilities({ query: { meetingIds: ids.join(",") } }),
    ),
  );
  return answers
    .flatMap(({ data }) => data.meetings)
    .filter((meeting) => meeting.overridden)
    .map((meeting) => ({ eventId: meeting.meetingId, status: meeting.status }));
}

export async function fetchOverrideBlocks(
  start: string,
  end: string,
): Promise<OverrideBlockDto[]> {
  const answers = await Promise.all(
    rangeChunks(start, end).map((range) =>
      listAvailabilityBlocks({ query: range }),
    ),
  );
  // A block across two pieces is in both.
  const byId = new Map<string, OverrideBlockDto>();
  for (const { data } of answers) {
    for (const block of data.blocks) byId.set(block.id, block);
  }
  return [...byId.values()];
}

export async function fetchStatusTimeline(
  start: string,
  end: string,
  settings?: {
    dayStart: string;
    dayEnd: string;
    treatWeekendsAsWorking: boolean;
    timezone: string;
  },
): Promise<StatusTimeline> {
  const answers = await Promise.all(
    rangeChunks(start, end).map((range) =>
      getAvailability({
        query: {
          ...range,
          dayStart: settings?.dayStart,
          dayEnd: settings?.dayEnd,
          includeWeekends: settings?.treatWeekendsAsWorking,
        },
        headers: settings?.timezone
          ? { "x-ncfritz-tz": settings.timezone }
          : undefined,
      }),
    ),
  );
  const timeline: StatusTimeline = {};
  for (const { data } of answers) {
    for (const slot of data.availability.slots) {
      timeline[String(Date.parse(slot.startTime) / 60_000)] = slot.status;
    }
  }
  return timeline;
}

export async function setEventOverride(
  eventId: string,
  status: AvailabilityStatus,
): Promise<void> {
  await setMeetingAvailability({
    path: { meetingId: eventId },
    body: { availability: { status } },
  });
}

export async function clearEventOverride(eventId: string): Promise<void> {
  await clearMeetingAvailability({ path: { meetingId: eventId } });
}

export async function createOverrideBlock(block: {
  startTime: string;
  endTime: string;
  status: AvailabilityStatus;
  label?: string;
}): Promise<OverrideBlockDto> {
  const { data } = await createAvailabilityBlock({ body: { block } });
  return data.block;
}

export async function updateOverrideBlock(
  id: string,
  status: AvailabilityStatus,
): Promise<OverrideBlockDto> {
  const { data } = await updateAvailabilityBlock({
    path: { blockId: id },
    body: { block: { status } },
  });
  return data.block;
}

export async function deleteOverrideBlock(id: string): Promise<void> {
  await deleteAvailabilityBlock({ path: { blockId: id } });
}

export async function fetchOutboxSummary(): Promise<OutboxSummary> {
  const { data } = await apiClient.GET("/v1/outbox/summary");
  return data?.outboxSummary ?? { enabled: false, sources: [] };
}

export async function fetchFailedOutboxRecords(
  limit?: number,
): Promise<OutboxRecord[]> {
  const { data } = await apiClient.GET("/v1/outbox-events/failed", {
    params: { query: { limit } },
  });
  return data?.outboxEvents ?? [];
}

export async function requeueOutboxRecord(id: string): Promise<void> {
  const { error } = await apiClient.POST(
    "/v1/outbox-event/{outboxEventId}/requeue",
    { params: { path: { outboxEventId: id } } },
  );
  if (error)
    throw new Error(`Failed to requeue outbox row: ${JSON.stringify(error)}`);
}

export async function fetchEventPublishStatus(
  eventId: string,
): Promise<EventPublishStatus> {
  const { data } = await apiClient.GET("/v1/event/{eventId}/publish-status", {
    params: { path: { eventId } },
  });
  return data?.eventPublishStatus ?? { enabled: false };
}

export async function backfillCalendar(
  calendarId: string,
): Promise<BackfillResult> {
  const { data, error } = await apiClient.POST(
    "/v1/calendar/{calendarId}/backfill",
    { params: { path: { calendarId } } },
  );
  if (error || !data)
    throw new Error(`Failed to start backfill: ${JSON.stringify(error)}`);
  return data.backfill;
}
