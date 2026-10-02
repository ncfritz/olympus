import timeGridPlugin from "@fullcalendar/timegrid";
import FullCalendar from "@fullcalendar/react";
import type { Meeting } from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import React from "react";
import meetingsApi from "../../../api/meetingsApi";

export interface DayCalendarProps {
  /** The day shown, YYYY-MM-DD. */
  day: string;
  meetings: Meeting[];
  /** Planned blocks drawn with the meetings, apart from them. */
  blocks?: { id: string; title: string; start: Date; end: Date }[];
}

/**
 * A day's calendar as Meetings draws it, as a time grid filling its
 * container's height, whether the day has meetings or not.
 */
const DayCalendar: React.FunctionComponent<DayCalendarProps> = ({
  day,
  meetings,
  blocks = [],
}) => (
  <FullCalendar
    plugins={[timeGridPlugin]}
    viewClassNames={"minerva-cal hide-day-header"}
    initialView={"timeGridDay"}
    initialDate={DateTime.fromISO(day).toJSDate()}
    events={[
      ...meetings.filter((m) => !m.isDeleted).map(meetingsApi.toEvent),
      // A plan, not a meeting: drawn in the plan's green.
      ...blocks.map((b) => ({
        ...b,
        editable: false,
        backgroundColor: "#f6ffed",
        borderColor: "#52c41a",
        textColor: "#135200",
      })),
    ]}
    headerToolbar={false}
    height={"100%"}
    allDayText={""}
    slotDuration={{ minutes: 30 }}
    scrollTime={"08:00:00"}
    slotLabelFormat={{ hour: "numeric", meridiem: "short" }}
    businessHours={{
      days: [1, 2, 3, 4, 5],
      startTime: "9:00",
      endTime: "17:00",
    }}
    nowIndicator={true}
  />
);

export default DayCalendar;
