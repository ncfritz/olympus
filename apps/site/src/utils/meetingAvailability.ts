import type { EventInput } from "@fullcalendar/core";
import type {
  AvailabilityBlock,
  Meeting,
  MeetingAvailability,
} from "@ncfritz/olympus-sdk/minerva";
import { type OnAirStatus, toOnAirStatus } from "./onair";

/*
 * Availability on the meetings pages (ADR 0029): each meeting's status dot,
 * the override blocks among the meetings, and which of them are shown. The
 * words are the OnAir drawer's (dnd, interrupt, free, clear).
 */

/** The statuses a meeting or a block can be set to, in the picker's order. */
export const OVERRIDE_STATUSES: { status: OnAirStatus; label: string }[] = [
  { status: "dnd", label: "Do Not Disturb" },
  { status: "interrupt", label: "Interruptable" },
  { status: "free", label: "Free" },
  { status: "clear", label: "Clear" },
];

/**
 * What the status filter sorts by: an override's status, or "default" for
 * a meeting with none, which shows its calendar's.
 */
export type OverrideFilter = OnAirStatus | "default";

export const OVERRIDE_FILTERS: { key: OverrideFilter; label: string }[] = [
  ...OVERRIDE_STATUSES.map(({ status, label }) => ({ key: status, label })),
  { key: "default", label: "No override" },
];

/** What is hidden. Everything is shown until it is hidden. */
export interface MeetingFilters {
  /** Calendars, by `source`. */
  hiddenSources: string[];
  hiddenStatuses: OverrideFilter[];
}

/**
 * A meeting's status with no override, as the API derives it
 * (`levelOfMeetingStatus`): shown until its availability has loaded.
 */
export const defaultStatusOf = (status: string): OnAirStatus => {
  switch (status) {
    case "Free":
      return "free";
    case "Tentative":
      return "interrupt";
    case "OOF":
    case "WorkingElsewhere":
      return "clear";
    default:
      return "dnd";
  }
};

/** What a meeting's dot shows: its override, else its calendar's status. */
export const dotStatusOf = (
  meeting: Pick<Meeting, "status">,
  availability?: Pick<MeetingAvailability, "status">,
): OnAirStatus =>
  availability
    ? toOnAirStatus(availability.status)
    : defaultStatusOf(meeting.status);

/** Which status filter a meeting falls under. */
export const filterOf = (
  availability?: Pick<MeetingAvailability, "status" | "overridden">,
): OverrideFilter =>
  availability?.overridden ? toOnAirStatus(availability.status) : "default";

/**
 * The calendar a meeting came from. The SDK types `source` narrowly, but
 * it carries the calendar's `source`.
 */
export const sourceOf = (meeting: Pick<Meeting, "source">): string =>
  meeting.source as string;

export const isMeetingShown = (
  meeting: Pick<Meeting, "source">,
  availability: Pick<MeetingAvailability, "status" | "overridden"> | undefined,
  filters: MeetingFilters,
): boolean =>
  !filters.hiddenSources.includes(sourceOf(meeting)) &&
  !filters.hiddenStatuses.includes(filterOf(availability));

export const isBlockShown = (
  block: Pick<AvailabilityBlock, "status">,
  filters: MeetingFilters,
): boolean => !filters.hiddenStatuses.includes(toOnAirStatus(block.status));

/** What the calendars' event content reads from an event. */
export type AvailabilityEventProps =
  | {
      kind: "meeting";
      meetingId: string;
      status: OnAirStatus;
      overridden: boolean;
    }
  | {
      kind: "block";
      blockId: string;
      status: OnAirStatus;
      overridden: true;
    };

/** What changing a dot's status does, for meetings and blocks alike. */
export interface AvailabilityActions {
  setMeetingStatus: (meetingId: string, status: OnAirStatus) => Promise<void>;
  removeMeetingOverride: (meetingId: string) => Promise<void>;
  setBlockStatus: (blockId: string, status: OnAirStatus) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
}

/** A block's event ID, apart from any meeting's. */
export const blockEventId = (blockId: string) => `block:${blockId}`;

/** A meeting's event, with what its dot shows. */
export const meetingEvent = (
  event: EventInput,
  meeting: Pick<Meeting, "id" | "status">,
  availability?: Pick<MeetingAvailability, "status" | "overridden">,
): EventInput => ({
  ...event,
  extendedProps: {
    ...event.extendedProps,
    kind: "meeting",
    meetingId: meeting.id,
    status: dotStatusOf(meeting, availability),
    overridden: availability?.overridden ?? false,
  } satisfies AvailabilityEventProps,
});

/** An override block's event: hatched in its status, moved by dragging. */
export const blockEvent = (block: AvailabilityBlock): EventInput => {
  const status = toOnAirStatus(block.status);
  return {
    id: blockEventId(block.id),
    start: block.startTime,
    end: block.endTime,
    title: block.label ?? "Override",
    editable: true,
    classNames: ["oa-event", `oa-override-${status}`],
    extendedProps: {
      kind: "block",
      blockId: block.id,
      status,
      overridden: true,
    } satisfies AvailabilityEventProps,
  };
};

/** Marks a status dot, so a click on one is told from one on its event. */
export const DOT_ATTRIBUTE = "data-availability-dot";

/** Whether a click on an event was on its status dot. */
export const isDotClick = (jsEvent: MouseEvent): boolean =>
  jsEvent.target instanceof Element &&
  jsEvent.target.closest(`[${DOT_ATTRIBUTE}]`) !== null;

/** Meeting IDs in groups the API takes at once (500). */
export const inGroups = <T>(items: T[], size = 500): T[][] => {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
};
