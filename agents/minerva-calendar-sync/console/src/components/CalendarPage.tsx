"use client";

import useSWR from "swr";
import { fetchCalendars } from "@/lib/api/queries";
import { useCalendarColors } from "@/lib/useCalendarColors";
import { EventsPanel } from "./EventsPanel";

export function CalendarPage() {
  const { data: calendars = [] } = useSWR("/calendars", fetchCalendars);
  const { colorForSource, setSourceColor } = useCalendarColors();

  return (
    <>
      <EventsPanel
        calendars={calendars}
        colorForSource={colorForSource}
        onSetSourceColor={setSourceColor}
      />
    </>
  );
}
