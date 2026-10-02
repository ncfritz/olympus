import type { Meeting, Note } from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import React from "react";
import {
  busyMinutes,
  formatMinutes,
  meetingSpans,
} from "../../../utils/reviews";
import DayCalendar from "./DayCalendar";
import NoteList from "./NoteList";
import styles from "./Review.module.css";

export interface DayReferenceProps {
  /** The day, YYYY-MM-DD. */
  day: string;
  notes: Note[];
  meetings: Meeting[];
}

/**
 * A day's record beside a step: its notes, scrolling under their heading,
 * and its calendar at full height, shown whether it has meetings or not.
 */
const DayReference: React.FunctionComponent<DayReferenceProps> = ({
  day,
  notes,
  meetings,
}) => (
  <div className={styles.sidePanes}>
    <section className={styles.notesPane} aria-label={"Notes"}>
      <div className={styles.paneHeader}>
        <span>Notes</span>
        <span className={styles.meta}>{notes.length}</span>
      </div>
      <div className={styles.paneScroll}>
        <NoteList notes={notes} />
      </div>
    </section>
    <section className={styles.calendarPane} aria-label={"Calendar"}>
      <div className={styles.paneHeader}>
        <span>Calendar</span>
        <span className={styles.meta}>
          {formatMinutes(
            busyMinutes(meetingSpans(meetings, DateTime.fromISO(day))),
          )}
        </span>
      </div>
      <div className={styles.calendarFill}>
        <DayCalendar day={day} meetings={meetings} />
      </div>
    </section>
  </div>
);

export default DayReference;
