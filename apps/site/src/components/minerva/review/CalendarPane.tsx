import type { Meeting } from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import React from "react";
import {
  busyMinutes,
  formatMinutes,
  meetingSpans,
} from "../../../utils/reviews";
import DayCalendar, { type DayCalendarProps } from "./DayCalendar";
import styles from "./Review.module.css";

export interface CalendarPaneProps {
  /** The day, YYYY-MM-DD. */
  day: string;
  meetings: Meeting[];
  blocks?: DayCalendarProps["blocks"];
  onBlockChange?: DayCalendarProps["onBlockChange"];
  onBlockRemove?: DayCalendarProps["onBlockRemove"];
  onBlockDrop?: DayCalendarProps["onBlockDrop"];
  /** A line under the heading, such as the day's open time. */
  note?: React.ReactNode;
  /** The pane's heading; "Calendar" by default. */
  title?: string;
  /** Which side the pane sits on, for the border between it and the rest. */
  side?: "left" | "right";
}

/**
 * A day's calendar as a 500px pane at full height: its heading with the
 * time in meetings, and the day's grid, whether it has meetings or not.
 */
const CalendarPane: React.FunctionComponent<CalendarPaneProps> = ({
  day,
  meetings,
  blocks,
  onBlockChange,
  onBlockRemove,
  onBlockDrop,
  note,
  title = "Calendar",
  side = "right",
}) => (
  <section
    className={`${styles.calendarPane} ${side === "left" ? styles.calendarLeft : ""}`}
    aria-label={title}
  >
    <div className={styles.paneHeader}>
      <span>{title}</span>
      <span className={styles.meta}>
        {formatMinutes(
          busyMinutes(meetingSpans(meetings, DateTime.fromISO(day))),
        )}
      </span>
    </div>
    {note && <div className={styles.paneNote}>{note}</div>}
    <div className={styles.calendarFill}>
      <DayCalendar
        day={day}
        meetings={meetings}
        blocks={blocks}
        onBlockChange={onBlockChange}
        onBlockRemove={onBlockRemove}
        onBlockDrop={onBlockDrop}
      />
    </div>
  </section>
);

export default CalendarPane;
