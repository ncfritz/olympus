import type {
  Availability,
  AvailabilityLevel,
} from "@ncfritz/olympus-sdk/minerva";

export const Colors = {
  DND: "#990000",
  INTERRUPT: "#ffcc00",
  FREE: "#009900",
  CLEAR: "#dddddd",
};

export const getColorForStatus = (status: string) => {
  switch (status) {
    case "dnd":
      return Colors.DND;
    case "interrupt":
      return Colors.INTERRUPT;
    case "free":
      return Colors.FREE;
    default:
      return Colors.CLEAR;
  }
};

/*
 * The OnAir drawer's words for Minerva's availability levels (ADR 0029).
 * The drawer keeps the shapes and words it had with the legacy OnAir
 * service; these turn the API's availability into them and back.
 */

/** The drawer's word for a level. */
export type OnAirStatus = "dnd" | "interrupt" | "free" | "clear";

const TO_ONAIR: Record<AvailabilityLevel, OnAirStatus> = {
  busy: "dnd",
  interruptable: "interrupt",
  free: "free",
  none: "clear",
};

const TO_LEVEL: Record<OnAirStatus, AvailabilityLevel> = {
  dnd: "busy",
  interrupt: "interruptable",
  free: "free",
  clear: "none",
};

/** The strength of each level's slot, as the drawer shades it. */
const SIGNAL: Record<AvailabilityLevel, number> = {
  busy: 4,
  interruptable: 2,
  free: 1,
  none: 0,
};

const SLOT_MS = 15 * 60 * 1000;

export const toOnAirStatus = (level: AvailabilityLevel): OnAirStatus =>
  TO_ONAIR[level] ?? "clear";

/** The level for a drawer word; anything else is none. */
export const toLevel = (status: string): AvailabilityLevel =>
  TO_LEVEL[status as OnAirStatus] ?? "none";

/** Whether the ON AIR button lights: busy or interruptable. */
export const isOnAir = (level: AvailabilityLevel | undefined): boolean =>
  level === "busy" || level === "interruptable";

/** A slot's strength in the drawer's shading: dnd 4+, interrupt 2+, free 1+. */
export const signalStatus = (signal: number): OnAirStatus => {
  if (signal >= 4) return "dnd";
  if (signal >= 2) return "interrupt";
  if (signal >= 1) return "free";
  return "clear";
};

export type OnAirCalendarEvent = {
  id: string;
  start: string;
  end: string;
  editable?: boolean;
  extendedProps: {
    subject: string;
    /** A meeting's calendar status, or a block's drawer word. */
    status: string;
    /** The drawer's word for the level the user set on a meeting. */
    onairStatus?: OnAirStatus;
    type?: "Override";
  };
};

/** What the drawer's calendar shows: the legacy service's shapes. */
export type OnAirEvents = {
  /** Each slot's strength, by 15-minute slot since the epoch. */
  signals: Record<string, number>;
  /** The user's meetings, as calendar events. */
  events: OnAirCalendarEvent[];
  /** The user's blocks, as calendar events. */
  overrides: OnAirCalendarEvent[];
  start: string;
  end: string;
};

/**
 * The API's availability in the drawer's shapes: slot strengths, meetings
 * with their calendar status (and the drawer's word for the level the
 * user set, if they did), and blocks as overrides.
 */
export const toOnAirEvents = (availability: Availability): OnAirEvents => ({
  signals: Object.fromEntries(
    availability.slots.map((slot) => [
      String(Math.floor(Date.parse(slot.startTime) / SLOT_MS)),
      SIGNAL[slot.status] ?? 0,
    ]),
  ),
  events: availability.meetings.map((meeting) => ({
    id: meeting.meetingId,
    start: meeting.startTime,
    end: meeting.endTime,
    editable: false,
    extendedProps: {
      subject: meeting.subject ?? "",
      status: meeting.calendarStatus,
      ...(meeting.overridden
        ? { onairStatus: toOnAirStatus(meeting.status) }
        : {}),
    },
  })),
  overrides: availability.blocks.map((block) => ({
    id: block.id,
    start: block.startTime,
    end: block.endTime,
    extendedProps: {
      subject: block.label ?? "OVERRIDE",
      status: toOnAirStatus(block.status),
      type: "Override",
    },
  })),
  start: availability.startTime,
  end: availability.endTime,
});

/** The days the drawer can show: a week back, two weeks ahead. */
export const drawerRange = (now: Date): { start: string; end: string } => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = 24 * 60 * 60 * 1000;
  return {
    start: new Date(today.getTime() - 7 * day).toISOString(),
    end: new Date(today.getTime() + 15 * day).toISOString(),
  };
};
