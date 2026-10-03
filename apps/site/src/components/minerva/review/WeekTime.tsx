import { Statistic } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { daysOfWeek, formatMinutes, weekLoad } from "../../../utils/reviews";
import styles from "./Review.module.css";
import type { WeeklyReviewData } from "./useWeeklyReview";
import { TimeChart } from "./WeekCharts";

export interface WeekTimeProps {
  data: Pick<WeeklyReviewData, "monday" | "meetings" | "dayItems">;
}

/**
 * The week's time: hours in meetings and in focus blocks, and the two by
 * day. Look back and Reflect both show it.
 */
const WeekTime: React.FunctionComponent<WeekTimeProps> = ({ data }) => {
  const days = daysOfWeek(DateTime.fromISO(data.monday));
  const loads = weekLoad(data.meetings, days, data.dayItems);
  const meetingMinutes = loads.reduce((sum, d) => sum + d.meetingMinutes, 0);
  const focusMinutes = loads.reduce((sum, d) => sum + d.focusMinutes, 0);
  const meetingCount = loads.reduce((sum, d) => sum + d.meetings, 0);
  return (
    <div className={styles.stack}>
      <div className={styles.numbers}>
        <Statistic
          title={`in meetings · ${meetingCount} event${meetingCount === 1 ? "" : "s"}`}
          value={formatMinutes(meetingMinutes)}
        />
        <Statistic
          title={"in focus blocks"}
          value={formatMinutes(focusMinutes)}
        />
      </div>
      <TimeChart days={days.map((d) => d.toFormat("ccc d"))} loads={loads} />
    </div>
  );
};

export default WeekTime;
