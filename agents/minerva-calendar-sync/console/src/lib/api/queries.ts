import { apiClient } from "./client";
import type { components } from "../../generated/api";

export type EventDto = components["schemas"]["EventResponseDto"];
export type CalendarStatus = components["schemas"]["CalendarStatusDto"];
export type AvailabilityStatus =
  components["schemas"]["EventOverrideResponseDto"]["status"];
export type FreeBusyStatus = EventDto["status"];
export type EventOverrideDto =
  components["schemas"]["EventOverrideResponseDto"];
export type OverrideBlockDto =
  components["schemas"]["OverrideBlockResponseDto"];
export type CalendarAccountStatus =
  components["schemas"]["CalendarAccountStatusDto"];
export type AvailableCalendar = components["schemas"]["AvailableCalendarDto"];
export type SyncRun = components["schemas"]["SyncRunDto"];
export type SyncRunDetail = components["schemas"]["SyncRunDetailDto"];
export type SyncRunEventChange = components["schemas"]["SyncRunEventChangeDto"];
export type SyncRunDailyStat = components["schemas"]["SyncRunDailyStatDto"];
export type OutboxSummary = components["schemas"]["OutboxSummaryDto"];
export type OutboxSourceStats = components["schemas"]["OutboxSourceStatsDto"];
export type OutboxRecord = components["schemas"]["OutboxRecordDto"];
export type EventPublishStatus = components["schemas"]["EventPublishStatusDto"];
export type BackfillResult = components["schemas"]["BackfillResultDto"];

/** Keyed by each 15-minute chunk's start time, in minutes since epoch (as a string, since JSON object keys always are). */
export type StatusTimeline = Record<string, AvailabilityStatus>;

export async function fetchMe() {
  const { data } = await apiClient.GET("/auth/me");
  return data ?? null;
}

export async function logout() {
  await apiClient.POST("/auth/logout");
}

export async function fetchCalendars(): Promise<CalendarStatus[]> {
  const { data } = await apiClient.GET("/calendars");
  return data ?? [];
}

export async function fetchCalendarColors(): Promise<Record<string, string>> {
  const { data } = await apiClient.GET("/calendar-colors");
  return data ?? {};
}

export async function setCalendarColor(
  source: string,
  color: string,
): Promise<void> {
  const { error } = await apiClient.PUT("/calendar-colors/{source}", {
    params: { path: { source } },
    body: { color },
  });
  if (error)
    throw new Error(`Failed to set calendar color: ${JSON.stringify(error)}`);
}

export async function triggerCalendarSync(
  calendarId: string,
): Promise<boolean> {
  const { response } = await apiClient.POST("/calendars/{calendarId}/sync", {
    params: { path: { calendarId } },
  });
  return response.ok;
}

export async function setCalendarEnabled(
  calendarId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await apiClient.PUT("/calendars/{calendarId}/enabled", {
    params: { path: { calendarId } },
    body: { enabled },
  });
  if (error)
    throw new Error(`Failed to set calendar enabled: ${JSON.stringify(error)}`);
}

export async function setCalendarIncludedInBusy(
  calendarId: string,
  includedInBusy: boolean,
): Promise<void> {
  const { error } = await apiClient.PUT(
    "/calendars/{calendarId}/included-in-busy",
    {
      params: { path: { calendarId } },
      body: { includedInBusy },
    },
  );
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
  const { data, error } = await apiClient.POST("/calendars", {
    body: calendar,
  });
  if (error || !data)
    throw new Error(`Failed to add calendar: ${JSON.stringify(error)}`);
  return data;
}

export async function removeCalendar(calendarId: string): Promise<void> {
  const { error } = await apiClient.DELETE("/calendars/{calendarId}", {
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
    "/calendar-accounts/{accountLabel}/available-calendars",
    { params: { path: { accountLabel }, query: { provider } } },
  );
  return data ?? [];
}

export async function fetchCalendarAccountStatuses(): Promise<
  CalendarAccountStatus[]
> {
  const { data } = await apiClient.GET("/calendar-accounts");
  return data ?? [];
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
  const { data } = await apiClient.GET("/sync-runs", {
    params: { query: filter },
  });
  return data ?? [];
}

export async function fetchSyncRun(id: string): Promise<SyncRunDetail | null> {
  const { data } = await apiClient.GET("/sync-runs/{id}", {
    params: { path: { id } },
  });
  return data ?? null;
}

export async function fetchSyncRunStats(
  filter: SyncRunFilterParams & { days?: number },
): Promise<SyncRunDailyStat[]> {
  const { data } = await apiClient.GET("/sync-runs/stats", {
    params: { query: filter },
  });
  return data ?? [];
}

/** Starts a new device-flow login for a calendar-sync account; returns the URL to open so the user can complete it. */
export async function startCalendarAccountReauth(
  accountLabel: string,
  provider: "google" | "microsoft",
): Promise<string> {
  const { data, error } = await apiClient.POST(
    "/calendar-accounts/{accountLabel}/reauth",
    { params: { path: { accountLabel }, query: { provider } } },
  );
  if (error || !data)
    throw new Error(`Failed to start reauth: ${JSON.stringify(error)}`);
  return data.authUrl;
}

export type NewAccountAuthStatus =
  components["schemas"]["NewAccountAuthStatusDto"];

/** Starts authorizing a brand-new account for the given provider; returns an id to poll and the URL to open to complete it. */
export async function startNewAccountAuth(
  provider: "google" | "microsoft",
): Promise<{ transactionId: string; authUrl: string }> {
  const { data, error } = await apiClient.POST("/calendar-accounts/new", {
    body: { provider },
  });
  if (error || !data)
    throw new Error(`Failed to start authorization: ${JSON.stringify(error)}`);
  return data;
}

export async function fetchNewAccountAuthStatus(
  transactionId: string,
): Promise<NewAccountAuthStatus> {
  const { data, error } = await apiClient.GET(
    "/calendar-accounts/new/{transactionId}",
    { params: { path: { transactionId } } },
  );
  if (error || !data)
    throw new Error(
      `Failed to check authorization status: ${JSON.stringify(error)}`,
    );
  return data;
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
  const { data } = await apiClient.GET("/events", {
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
  return data ?? [];
}

/** Bulk lookup — one request for a whole page of events rather than N. */
export async function fetchEventOverrides(
  eventIds: string[],
): Promise<EventOverrideDto[]> {
  if (eventIds.length === 0) return [];
  const { data } = await apiClient.GET("/events/overrides", {
    params: { query: { ids: eventIds.join(",") } },
  });
  return data ?? [];
}

export async function fetchOverrideBlocks(
  start: string,
  end: string,
): Promise<OverrideBlockDto[]> {
  const { data } = await apiClient.GET("/overrides", {
    params: { query: { start, end } },
  });
  return data ?? [];
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
  const { data } = await apiClient.GET("/freebusy/timeline", {
    params: {
      query: {
        start,
        end,
        dayStart: settings?.dayStart,
        dayEnd: settings?.dayEnd,
        treatWeekendsAsWorking: settings?.treatWeekendsAsWorking,
        timezone: settings?.timezone,
      },
    },
  });
  return data ?? {};
}

export async function setEventOverride(
  source: string,
  uid: string,
  status: AvailabilityStatus,
): Promise<void> {
  const { error } = await apiClient.PUT("/events/{source}/{uid}/override", {
    params: { path: { source, uid } },
    body: { status },
  });
  if (error)
    throw new Error(`Failed to set override: ${JSON.stringify(error)}`);
}

export async function clearEventOverride(
  source: string,
  uid: string,
): Promise<void> {
  const { error } = await apiClient.DELETE("/events/{source}/{uid}/override", {
    params: { path: { source, uid } },
  });
  if (error)
    throw new Error(`Failed to clear override: ${JSON.stringify(error)}`);
}

export async function createOverrideBlock(block: {
  startTime: string;
  endTime: string;
  status: AvailabilityStatus;
  label?: string;
}): Promise<OverrideBlockDto> {
  const { data, error } = await apiClient.POST("/overrides", { body: block });
  if (error || !data)
    throw new Error(
      `Failed to create override block: ${JSON.stringify(error)}`,
    );
  return data;
}

export async function updateOverrideBlock(
  id: string,
  status: AvailabilityStatus,
): Promise<OverrideBlockDto> {
  const { data, error } = await apiClient.PUT("/overrides/{id}", {
    params: { path: { id } },
    body: { status },
  });
  if (error || !data)
    throw new Error(
      `Failed to update override block: ${JSON.stringify(error)}`,
    );
  return data;
}

export async function deleteOverrideBlock(id: string): Promise<void> {
  const { error } = await apiClient.DELETE("/overrides/{id}", {
    params: { path: { id } },
  });
  if (error)
    throw new Error(
      `Failed to delete override block: ${JSON.stringify(error)}`,
    );
}

export async function fetchOutboxSummary(): Promise<OutboxSummary> {
  const { data } = await apiClient.GET("/outbox/summary");
  return data ?? { enabled: false, sources: [] };
}

export async function fetchFailedOutboxRecords(
  limit?: number,
): Promise<OutboxRecord[]> {
  const { data } = await apiClient.GET("/outbox/failed", {
    params: { query: { limit } },
  });
  return data ?? [];
}

export async function requeueOutboxRecord(id: string): Promise<void> {
  const { error } = await apiClient.POST("/outbox/failed/{id}/requeue", {
    params: { path: { id } },
  });
  if (error)
    throw new Error(`Failed to requeue outbox row: ${JSON.stringify(error)}`);
}

export async function fetchEventPublishStatus(
  source: string,
  uid: string,
): Promise<EventPublishStatus> {
  const { data } = await apiClient.GET("/outbox/events/{source}/{uid}", {
    params: { path: { source, uid } },
  });
  return data ?? { enabled: false, latest: null };
}

export async function backfillCalendar(
  calendarId: string,
): Promise<BackfillResult> {
  const { data, error } = await apiClient.POST(
    "/calendars/{calendarId}/backfill",
    { params: { path: { calendarId } } },
  );
  if (error || !data)
    throw new Error(`Failed to start backfill: ${JSON.stringify(error)}`);
  return data;
}
