import type {
  DateSelectArg,
  DateSpanApi,
  EventChangeArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from "@fullcalendar/core";
import type { Meeting } from "@ncfritz/olympus-sdk/minerva";
import React, { useMemo, useState } from "react";
import meetingsApi from "../api/meetingsApi";
import AvailabilityEventContent from "../components/minerva/meetings/availability/AvailabilityEventContent";
import { useAppSelector } from "../redux/hooks";
import {
  type AvailabilityEventProps,
  blockEvent,
  blockEventId,
  isBlockShown,
  isDotClick,
  isMeetingShown,
  meetingEvent,
} from "../utils/meetingAvailability";
import useMeetingAvailability from "./useMeetingAvailability";

export interface AvailabilityCalendarOptions {
  /** The meetings over the range shown. */
  meetings: Meeting[];
  /** The range shown, for the override blocks. */
  start?: Date;
  end?: Date;
  /** Leaves meetings out whatever the filters say (the month's all-day). */
  include?: (meeting: Meeting) => boolean;
  /** A click on a meeting, other than on its dot. */
  onMeetingClick: (arg: EventClickArg) => void;
}

/** What a meetings page's FullCalendar takes for availability. */
export interface AvailabilityCalendarProps {
  events: EventInput[];
  eventContent: (arg: EventContentArg) => React.ReactNode;
  eventClick: (arg: EventClickArg) => void;
  select: (arg: DateSelectArg) => Promise<void>;
  selectAllow: (span: DateSpanApi) => boolean;
  eventChange: (arg: EventChangeArg) => Promise<void>;
}

/**
 * Availability on a meetings page's calendar (ADR 0029): each meeting's
 * status dot and picker, the override blocks, the filters, and a block
 * made by selecting a range, with no status (Clear) until one is picked
 * from its dot, which opens at once.
 */
const useAvailabilityCalendar = ({
  meetings,
  start,
  end,
  include = () => true,
  onMeetingClick,
}: AvailabilityCalendarOptions): AvailabilityCalendarProps => {
  const filters = useAppSelector((state) => state.meetings);
  const [pickerFor, setPickerFor] = useState<string>();

  const meetingIds = useMemo(() => meetings.map((m) => m.id), [meetings]);
  const { availabilities, blocks, actions } = useMeetingAvailability(
    meetingIds,
    start,
    end,
  );

  const events = useMemo(
    () => [
      ...meetings
        .filter(
          (m) => include(m) && isMeetingShown(m, availabilities[m.id], filters),
        )
        .map((m) =>
          meetingEvent(meetingsApi.toEvent(m), m, availabilities[m.id]),
        ),
      ...blocks.filter((b) => isBlockShown(b, filters)).map(blockEvent),
    ],
    // `include` is the views' own rule, the same every render.
    [meetings, availabilities, blocks, filters],
  );

  return {
    events,
    eventContent: (arg) => (
      <AvailabilityEventContent
        arg={arg}
        actions={actions}
        open={pickerFor === arg.event.id}
        onOpenChange={(open) => setPickerFor(open ? arg.event.id : undefined)}
      />
    ),
    eventClick: (arg) => {
      if (isDotClick(arg.jsEvent)) return;
      const props = arg.event.extendedProps as Partial<AvailabilityEventProps>;
      if (props.kind === "block") {
        // A block has nothing to open but its picker.
        setPickerFor(arg.event.id);
      } else {
        onMeetingClick(arg);
      }
    },
    select: async (arg) => {
      arg.view.calendar.unselect();
      const blockId = await actions.createBlock(arg.start, arg.end);
      if (blockId) setPickerFor(blockEventId(blockId));
    },
    // A block is a time range: the all-day row would make one of midnights.
    selectAllow: (span) => !span.allDay,
    eventChange: async (arg) => {
      const props = arg.event.extendedProps as Partial<AvailabilityEventProps>;
      if (props.kind === "block" && arg.event.start && arg.event.end) {
        await actions.moveBlock(props.blockId!, arg.event.start, arg.event.end);
      } else {
        arg.revert();
      }
    },
  };
};

export default useAvailabilityCalendar;
