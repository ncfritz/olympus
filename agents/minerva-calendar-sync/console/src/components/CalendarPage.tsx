"use client";

import useSWR from "swr";
import { fetchCalendars } from "@/lib/api/queries";
import { useCalendarColors } from "@/lib/useCalendarColors";
import { AppLayout } from "./AppLayout";
import { EventsPanel } from "./EventsPanel";

export function CalendarPage() {
  const { data: calendars = [] } = useSWR("/calendars", fetchCalendars);
  const { colorForSource, setSourceColor } = useCalendarColors();

  return (
    <AppLayout>
      <EventsPanel
        calendars={calendars}
        colorForSource={colorForSource}
        onSetSourceColor={setSourceColor}
      />
    </AppLayout>
  );
}
