"use client";

import type {
  DateSelectArg,
  EventContentArg,
  EventMountArg,
} from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Dropdown, Space } from "antd";
import type { MenuProps } from "antd";
import { useEffect, useRef, useState } from "react";
import type { AvailabilityStatus, FreeBusyStatus } from "@/lib/api/queries";
import {
  AVAILABILITY_STATUSES,
  mapFreeBusyToAvailability,
  STATUS_LABEL,
  statusDotColor,
} from "@/lib/availability";

export type CalendarViewMode = "month" | "week" | "day";

/**
 * A unified row for both real tracked-calendar events and the synthetic
 * entries synthesized for override blocks with no underlying tracked
 * event (the "Overrides" pseudo-source) — see EventsPanel.
 */
export interface CalendarEntry {
  id: string;
  subject: string;
  source: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  cancelled: boolean;
  deleted: boolean;
  type: string;
  /** Only set for real events (isOverrideBlock: false) — the synced free/busy status. */
  freeBusyStatus?: FreeBusyStatus;
  /** True for a synthetic "Overrides" pseudo-source row (an override block with no associated tracked event). */
  isOverrideBlock: boolean;
  /** For a real event: the effective override applied to it, if any (block wins over a per-event override). For a pseudo row: the block's own status. */
  overrideStatus?: AvailabilityStatus;
}

const INITIAL_VIEW: Record<CalendarViewMode, string> = {
  month: "dayGridMonth",
  week: "timeGridWeek",
  day: "timeGridDay",
};

const FLAG_WIDTH_PX = 10;

/**
 * Tracks the native contextmenu listener attached to each event's root
 * element (see eventDidMount below), so eventWillUnmount can remove the
 * right one. Keyed by element rather than stashed as a DOM property.
 */
const contextMenuHandlers = new WeakMap<HTMLElement, (e: MouseEvent) => void>();

/**
 * Left-bar flag colors for un-overridden synced events, following
 * Outlook's own free/busy convention
 * (https://learn.microsoft.com/en-us/answers/questions/4524589): Free is
 * blank, Busy is solid blue, Tentative is blue stripes, and Out of
 * Office/Working Elsewhere is solid purple. Our 4-value model maps "none"
 * (which is exactly OOO + working elsewhere) onto that purple.
 */
const BUSY_FLAG = "#0078d4";
const TENTATIVE_STRIPE = stripe("#0078d4");
const OOO_FLAG = "#7719aa";
const FREE_FLAG = "#e6e6e6";

function stripe(color: string): string {
  return `repeating-linear-gradient(45deg, ${color}, ${color} 3px, #ffffff 3px, #ffffff 6px)`;
}

function syncedFlagStyle(status: AvailabilityStatus): {
  backgroundColor?: string;
  backgroundImage?: string;
} {
  switch (status) {
    case "busy":
      return { backgroundColor: BUSY_FLAG };
    case "interruptable":
      return { backgroundImage: TENTATIVE_STRIPE };
    case "none":
      return { backgroundColor: OOO_FLAG };
    case "free":
      return { backgroundColor: FREE_FLAG };
  }
}

/**
 * The left-bar flag style for an entry. An override — whether a standalone
 * block or one applied to a real event — is a deliberate user decision, not
 * a synced provider status, so it always gets a striped pattern (distinct
 * from the solid/blank Outlook palette used for un-overridden synced events
 * below), colored per the same none/free/interruptable/busy palette as the
 * drawer's status dot (statusDotColor) — except "none", whose dot color is
 * white and would be invisible as a stripe on the white event body, so it
 * gets a plain grey stripe instead.
 */
function flagFor(entry: CalendarEntry): {
  backgroundColor?: string;
  backgroundImage?: string;
} {
  const isOverridden =
    entry.isOverrideBlock || entry.overrideStatus !== undefined;
  if (isOverridden) {
    const status = entry.overrideStatus!;
    return {
      backgroundImage: stripe(
        status === "none" ? "#8c8c8c" : statusDotColor(status),
      ),
    };
  }
  return syncedFlagStyle(mapFreeBusyToAvailability(entry.freeBusyStatus!));
}

export function EventsCalendarView({
  mode,
  events,
  onSelectEvent,
  onSelectRange,
  onSetStatus,
  onDelete,
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
}) {
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
        : []),
    ];
  }

  return (
    <>
      <FullCalendar
        key={mode}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={INITIAL_VIEW[mode]}
        headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        height={700}
        nowIndicator
        selectable
        selectMirror
        unselectAuto
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
        events={events.map((entry) => ({
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
          },
        }))}
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
    </>
  );
}
