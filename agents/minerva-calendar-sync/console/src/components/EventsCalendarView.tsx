"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { EventDto } from "@/lib/api/queries";

export type CalendarViewMode = "month" | "week" | "day";

const INITIAL_VIEW: Record<CalendarViewMode, string> = {
  month: "dayGridMonth",
  week: "timeGridWeek",
  day: "timeGridDay",
};

function colorFor(event: EventDto): string {
  if (event.deleted) return "#ff4d4f";
  if (event.cancelled) return "#fa8c16";
  return "#1677ff";
}

export function EventsCalendarView({
  mode,
  events,
  onSelectEvent,
}: {
  mode: CalendarViewMode;
  events: EventDto[];
  onSelectEvent: (event: EventDto) => void;
}) {
  return (
    <FullCalendar
      key={mode}
      plugins={[dayGridPlugin, timeGridPlugin]}
      initialView={INITIAL_VIEW[mode]}
      headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
      height={700}
      nowIndicator
      events={events.map((event) => ({
        id: event.id,
        title: event.subject,
        start: event.startTime,
        end: event.endTime,
        allDay: event.allDay,
        backgroundColor: colorFor(event),
        borderColor: colorFor(event),
      }))}
      eventClick={(info) => {
        const event = events.find((e) => e.id === info.event.id);
        if (event) onSelectEvent(event);
      }}
    />
  );
}
