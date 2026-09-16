import { apiClient } from "./client";
import type { components } from "./schema";

export type EventDto = components["schemas"]["EventResponseDto"];
export type CalendarStatus = components["schemas"]["CalendarStatusDto"];
export type AvailabilityStatus = components["schemas"]["EventOverrideResponseDto"]["status"];
export type FreeBusyStatus = EventDto["status"];
export type EventOverrideDto = components["schemas"]["EventOverrideResponseDto"];
export type OverrideBlockDto = components["schemas"]["OverrideBlockResponseDto"];

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

export async function triggerCalendarSync(calendarId: string): Promise<boolean> {
  const { response } = await apiClient.POST("/calendars/{calendarId}/sync", {
    params: { path: { calendarId } },
  });
  return response.ok;
}

export interface EventFilters {
  showCancelled: boolean;
  showDeleted: boolean;
  limit: number;
}

export async function fetchEvents(filters: EventFilters): Promise<EventDto[]> {
  const { data } = await apiClient.GET("/events", {
    params: {
      query: {
        cancelled: filters.showCancelled ? undefined : false,
        deleted: filters.showDeleted ? undefined : false,
        limit: filters.limit,
      },
    },
  });
  return data ?? [];
}

/** Bulk lookup — one request for a whole page of events rather than N. */
export async function fetchEventOverrides(eventIds: string[]): Promise<EventOverrideDto[]> {
  if (eventIds.length === 0) return [];
  const { data } = await apiClient.GET("/events/overrides", { params: { query: { ids: eventIds.join(",") } } });
  return data ?? [];
}

export async function fetchOverrideBlocks(start: string, end: string): Promise<OverrideBlockDto[]> {
  const { data } = await apiClient.GET("/overrides", { params: { query: { start, end } } });
  return data ?? [];
}

export async function setEventOverride(source: string, uid: string, status: AvailabilityStatus): Promise<void> {
  const { error } = await apiClient.PUT("/events/{source}/{uid}/override", {
    params: { path: { source, uid } },
    body: { status },
  });
  if (error) throw new Error(`Failed to set override: ${JSON.stringify(error)}`);
}

export async function clearEventOverride(source: string, uid: string): Promise<void> {
  const { error } = await apiClient.DELETE("/events/{source}/{uid}/override", { params: { path: { source, uid } } });
  if (error) throw new Error(`Failed to clear override: ${JSON.stringify(error)}`);
}

export async function createOverrideBlock(block: {
  startTime: string;
  endTime: string;
  status: AvailabilityStatus;
  label?: string;
}): Promise<OverrideBlockDto> {
  const { data, error } = await apiClient.POST("/overrides", { body: block });
  if (error || !data) throw new Error(`Failed to create override block: ${JSON.stringify(error)}`);
  return data;
}

export async function updateOverrideBlock(id: string, status: AvailabilityStatus): Promise<OverrideBlockDto> {
  const { data, error } = await apiClient.PUT("/overrides/{id}", { params: { path: { id } }, body: { status } });
  if (error || !data) throw new Error(`Failed to update override block: ${JSON.stringify(error)}`);
  return data;
}

export async function deleteOverrideBlock(id: string): Promise<void> {
  const { error } = await apiClient.DELETE("/overrides/{id}", { params: { path: { id } } });
  if (error) throw new Error(`Failed to delete override block: ${JSON.stringify(error)}`);
}
