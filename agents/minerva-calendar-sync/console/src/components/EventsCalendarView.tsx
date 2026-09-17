"use client";

import type {
  DatesSetArg,
  DateSelectArg,
  EventContentArg,
  EventMountArg,
  EventInput,
} from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Dropdown, Space, theme } from "antd";
import type { MenuProps } from "antd";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import useSWR from "swr";
import {
  fetchStatusTimeline,
  type AvailabilityStatus,
} from "@/lib/api/queries";
import {
  AVAILABILITY_STATUSES,
  flagFor,
  STATUS_LABEL,
  statusDotColor,
  type CalendarEntry,
} from "@/lib/availability";
import { mergeTimelineChunks, mutedTimelineColor } from "@/lib/statusTimeline";
import type { TimelineSettings } from "@/lib/settings";

export type { CalendarEntry } from "@/lib/availability";

export type CalendarViewMode = "month" | "week" | "day";

const INITIAL_VIEW: Record<CalendarViewMode, string> = {
  month: "dayGridMonth",
  week: "timeGridWeek",
  day: "timeGridDay",
};

const FLAG_WIDTH_PX = 10;
/** Diameter of the small per-calendar color dot in an event's bottom-right corner. */
const CALENDAR_DOT_PX = 6;

/**
 * Tracks the native contextmenu listener attached to each event's root
 * element (see eventDidMount below), so eventWillUnmount can remove the
 * right one. Keyed by element rather than stashed as a DOM property.
 */
const contextMenuHandlers = new WeakMap<HTMLElement, (e: MouseEvent) => void>();

export function EventsCalendarView({
  mode,
  events,
  onSelectEvent,
  onSelectRange,
  onSetStatus,
  onDelete,
  onClear,
  colorForSource,
  timelineSettings,
}: {
  mode: CalendarViewMode;
  events: CalendarEntry[];
  onSelectEvent: (entry: CalendarEntry) => void;
  /** Fired when the user clicks/drags an empty spot on the calendar to create a new override block. */
  onSelectRange: (range: { start: string; end: string }) => void;
  /** Right-click menu: mark an entry (real event or override block) with an availability status. */
  onSetStatus: (entry: CalendarEntry, status: AvailabilityStatus) => void;
  /** Right-click menu: delete — only ever offered for pure override blocks. */
  onDelete: (entry: CalendarEntry) => void;
  /** Right-click menu: clear a per-event override — only ever offered when `hasEventOverride` is true. */
  onClear: (entry: CalendarEntry) => void;
  /** The user's chosen (or default) color for a calendar source — shown as a small dot in each event's bottom-right corner. */
  colorForSource: (source: string) => string;
  /** Day-start/day-end window, weekend handling, and timezone for the status timeline strip — see lib/settings. */
  timelineSettings: TimelineSettings;
}) {
  const { token } = theme.useToken();

  // Drives the per-15-minute status timeline strip (week/day only — see
  // globals.css's ".status-timeline-event" rules; month view doesn't get
  // one, since FullCalendar's dayGrid only renders all-day background
  // events, and a month cell has no room for sub-day granularity anyway).
  // Tracks whatever range FullCalendar is currently showing, via datesSet,
  // since that changes on prev/next/today navigation independently of the
  // `events` prop. Keying the fetch on `events` too (not just the range)
  // means an override change elsewhere in the panel — which changes
  // `events`' content, not just its reference — revalidates this
  // alongside it; SWR compares keys by value, so a same-content new array
  // reference doesn't refetch.
  const [visibleRange, setVisibleRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const { data: statusTimeline } = useSWR(
    mode !== "month" && visibleRange
      ? ["/freebusy/timeline", visibleRange, events, timelineSettings]
      : null,
    ([, range]) =>
      fetchStatusTimeline(range.start, range.end, timelineSettings),
  );

  // A single controlled menu instance, positioned at the click point and
  // targeting whichever entry was last right-clicked — rather than one
  // Dropdown per rendered event. FullCalendar re-creates event DOM nodes as
  // data changes underneath it, which left a per-event Dropdown's own
  // contextmenu listener in a stuck state after the first right-click (the
  // native menu would take over until something else forced a re-render).
  // This version's open/closed state and position live in plain React state
  // here, so they don't depend on any particular event node surviving.
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: CalendarEntry;
  } | null>(null);

  // eventDidMount's handler closes over this ref (not `events` directly) so
  // a right-click always resolves against the latest data, even though the
  // listener itself is attached once per event element and outlives
  // whatever render happened to be current at mount time.
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  });

  // Dismiss on an outside click — and swallow that click so it's consumed
  // by closing the menu, not also passed through to whatever's underneath
  // (e.g. FullCalendar's own drag-select, which would otherwise open the
  // "add override" drawer on the very click that was meant to dismiss the
  // menu). `trigger={[]}` on the Dropdown below means it never wires up
  // rc-trigger's own click-outside handling (that's only registered for the
  // trigger kinds actually listed), which is why Escape was the only thing
  // that closed the menu before this.
  //
  // Listening on "pointerdown"/"mousedown" rather than "click": FullCalendar
  // starts drag-select on the initial press, not on the eventual "click"
  // (which only fires after mouseup, by which point the press has already
  // been acted on) — so intercepting "click" was too late to prevent it.
  // Capture phase, not bubble: it needs to run before FullCalendar's own
  // listener on the target sees the event at all, and separately, that
  // plugin stops propagation on presses over the calendar grid, which would
  // stop a bubble-phase listener from ever seeing those anyway. Clicks
  // inside the menu itself are left alone so choosing an item still works.
  useEffect(() => {
    if (!contextMenu) return;
    const handlePressAway = (e: Event) => {
      const target = e.target as Element | null;
      if (target?.closest(".ant-dropdown")) return;
      e.preventDefault();
      e.stopPropagation();
      setContextMenu(null);
    };
    document.addEventListener("pointerdown", handlePressAway, true);
    document.addEventListener("mousedown", handlePressAway, true);
    return () => {
      document.removeEventListener("pointerdown", handlePressAway, true);
      document.removeEventListener("mousedown", handlePressAway, true);
    };
  }, [contextMenu]);

  function menuItemsFor(entry: CalendarEntry): MenuProps["items"] {
    return [
      ...AVAILABILITY_STATUSES.map((status) => ({
        key: status,
        label: (
          <Space size="small">
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: statusDotColor(status),
                border: "1px solid #d9d9d9",
              }}
            />
            {STATUS_LABEL[status]}
          </Space>
        ),
      })),
      ...(entry.isOverrideBlock
        ? [
            { type: "divider" as const },
            { key: "delete", label: "Delete", danger: true },
          ]
        : entry.hasEventOverride
          ? [{ type: "divider" as const }, { key: "clear", label: "Clear" }]
          : []),
    ];
  }

  return (
    <div
      style={
        {
          height: "100%",
          // FullCalendar's own stylesheet reads this custom property for
          // every grid/cell border — overriding it here is the only way to
          // keep the grid in step with antd's border color token instead of
          // FullCalendar's hardcoded default (#ddd), which reads as too
          // light against a dark background.
          "--fc-border-color": token.colorBorderSecondary,
        } as CSSProperties
      }
    >
      <FullCalendar
        key={mode}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={INITIAL_VIEW[mode]}
        headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        height="100%"
        // Without this, dayGridMonth renders timed events in its default
        // compact "list-item" style (a dot + time, no background/border) —
        // forcing "block" keeps month view's events visually identical to
        // week/day's (same custom eventContent, same white body/border).
        eventDisplay="block"
        nowIndicator
        selectable
        selectMirror
        unselectAuto
        datesSet={(arg: DatesSetArg) => {
          setVisibleRange({
            start: arg.start.toISOString(),
            end: arg.end.toISOString(),
          });
        }}
        select={(info: DateSelectArg) => {
          // `.start`/`.end` are real Date instants — toISOString() always
          // emits UTC, unlike `.startStr`/`.endStr`, which are ambiguous
          // floating local-time strings with no timezone offset.
          onSelectRange({
            start: info.start.toISOString(),
            end: info.end.toISOString(),
          });
          info.view.calendar.unselect();
        }}
        events={[
          // A muted, title-less "background" event per merged status-
          // timeline range — FullCalendar renders these as a plain rect
          // (no eventContent, no title) rather than a real event box, and
          // globals.css constrains that rect to a narrow strip on the day
          // column's left edge instead of its full width.
          ...(statusTimeline
            ? mergeTimelineChunks(statusTimeline).map(
                (chunk, index): EventInput => ({
                  id: `status-timeline:${index}`,
                  start: chunk.start,
                  end: chunk.end,
                  display: "background",
                  backgroundColor: mutedTimelineColor(chunk.status),
                  classNames: ["status-timeline-event"],
                }),
              )
            : []),
          ...events.map((entry) => ({
            id: entry.id,
            title: entry.subject,
            start: entry.startTime,
            end: entry.endTime,
            allDay: entry.allDay,
            // White body regardless of status — these are first-class
            // FullCalendar props, reactively re-applied whenever the event's
            // data changes (unlike DOM edits made in eventDidMount, which only
            // ever runs once per mount and won't pick up e.g. an override that
            // loads in after the event first renders).
            backgroundColor: "#ffffff",
            borderColor: "#d9d9d9",
            textColor: "#1f1f1f",
            extendedProps: {
              flag: flagFor(entry),
              hasOverrideBadge:
                !entry.isOverrideBlock && entry.overrideStatus !== undefined,
              overrideStatus: entry.overrideStatus,
              cancelled: entry.cancelled,
              deleted: entry.deleted,
              calendarColor: colorForSource(entry.source),
            },
          })),
        ]}
        eventContent={(arg: EventContentArg) => {
          const flag = arg.event.extendedProps.flag as {
            backgroundColor?: string;
            backgroundImage?: string;
          };
          const hasOverrideBadge = arg.event.extendedProps
            .hasOverrideBadge as boolean;
          const overrideStatus = arg.event.extendedProps.overrideStatus as
            AvailabilityStatus | undefined;
          const cancelled = arg.event.extendedProps.cancelled as boolean;
          const deleted = arg.event.extendedProps.deleted as boolean;
          const calendarColor = arg.event.extendedProps.calendarColor as string;

          return (
            <div
              style={{
                position: "relative",
                height: "100%",
                opacity: deleted ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: FLAG_WIDTH_PX,
                  ...flag,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 2,
                  right: 2,
                  width: CALENDAR_DOT_PX,
                  height: CALENDAR_DOT_PX,
                  borderRadius: "50%",
                  backgroundColor: calendarColor,
                  border: "1px solid rgba(0, 0, 0, 0.15)",
                }}
              />
              <div
                style={{
                  marginLeft: FLAG_WIDTH_PX + 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  overflow: "hidden",
                  padding: "2px 4px 0",
                }}
              >
                {hasOverrideBadge && overrideStatus && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: statusDotColor(overrideStatus),
                      border: "1px solid rgba(0, 0, 0, 0.25)",
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: cancelled ? "line-through" : undefined,
                  }}
                >
                  {arg.event.title}
                </span>
              </div>
            </div>
          );
        }}
        eventClick={(info) => {
          const entry = events.find((e) => e.id === info.event.id);
          if (entry) onSelectEvent(entry);
        }}
        // Attached directly to FullCalendar's own event element (info.el)
        // rather than via an onContextMenu prop inside eventContent: that
        // content is nested a few layers inside info.el (fc-event-main,
        // the harness anchor, ...), and which of those layers actually
        // receives the native contextmenu event is not consistent — so a
        // handler placed on an inner div can silently miss it. Binding to
        // info.el itself catches it regardless, since every inner layer
        // bubbles up through it.
        eventDidMount={(info: EventMountArg) => {
          const handler = (e: MouseEvent) => {
            e.preventDefault();
            const entry = eventsRef.current.find(
              (en) => en.id === info.event.id,
            );
            if (entry) setContextMenu({ x: e.clientX, y: e.clientY, entry });
          };
          contextMenuHandlers.set(info.el, handler);
          info.el.addEventListener("contextmenu", handler);
        }}
        eventWillUnmount={(info: EventMountArg) => {
          const handler = contextMenuHandlers.get(info.el);
          if (handler) info.el.removeEventListener("contextmenu", handler);
        }}
      />
      <Dropdown
        key={
          contextMenu
            ? `${contextMenu.entry.id}:${contextMenu.x}:${contextMenu.y}`
            : "closed"
        }
        open={contextMenu !== null}
        onOpenChange={(open) => {
          if (!open) setContextMenu(null);
        }}
        trigger={[]}
        menu={{
          items: contextMenu ? menuItemsFor(contextMenu.entry) : [],
          onClick: ({ key }) => {
            if (!contextMenu) return;
            const { entry } = contextMenu;
            setContextMenu(null);
            if (key === "delete") onDelete(entry);
            else if (key === "clear") onClear(entry);
            else onSetStatus(entry, key as AvailabilityStatus);
          },
        }}
      >
        <div
          style={{
            position: "fixed",
            left: contextMenu?.x ?? 0,
            top: contextMenu?.y ?? 0,
            // rc-trigger's popup-alignment math misbehaves against a
            // zero-size target (it intermittently placed the menu
            // thousands of pixels off-screen) — a 1px footprint keeps it
            // stable while staying visually invisible.
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
      </Dropdown>
    </div>
  );
}
