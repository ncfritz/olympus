"use client";

import { message } from "antd";
import { useCallback } from "react";
import useSWR from "swr";
import { fetchCalendarColors, setCalendarColor } from "@/lib/api/queries";
import { defaultColorFor } from "@/lib/calendarColors";

/**
 * Color customization for each calendar source, persisted server-side so
 * it's shared across browsers/sessions rather than per-viewer. Shared
 * between the calendar page's Events panel and the Sync page's Calendars
 * table, both of which let the user set it.
 */
export function useCalendarColors() {
  const { data: calendarColors = {}, mutate } = useSWR(
    "/calendar-colors",
    fetchCalendarColors,
  );

  const colorForSource = useCallback(
    (source: string) => calendarColors[source] ?? defaultColorFor(source),
    [calendarColors],
  );

  const setSourceColor = useCallback(
    async (source: string, color: string) => {
      try {
        await setCalendarColor(source, color);
        mutate();
      } catch (error) {
        message.error("Failed to save the calendar color");
        console.error(error);
      }
    },
    [mutate],
  );

  return { colorForSource, setSourceColor };
}
