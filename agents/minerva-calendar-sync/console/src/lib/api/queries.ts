import { apiClient } from "./client";
import type { components } from "./schema";

export type EventDto = components["schemas"]["EventResponseDto"];
export type CalendarStatus = components["schemas"]["CalendarStatusDto"];

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
