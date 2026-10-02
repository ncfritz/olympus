import { Card, Statistic } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { config } from "../../../utils/notes";
import {
  busyMinutes,
  dayBarBlocks,
  doneOfPlanned,
  formatMinutes,
  meetingSpans,
  noteTypeCounts,
} from "../../../utils/reviews";
import DayBar from "./DayBar";
import styles from "./Review.module.css";
import type { DailyReviewData } from "./useDailyReview";

export interface TodayNumbersProps {
  data: Pick<DailyReviewData, "day" | "meetings" | "notes" | "items">;
}

/**
 * The day in numbers: time in meetings, notes by type, planned items done,
 * and the day as a bar. Look back and Wrap up both show it.
 */
const TodayNumbers: React.FunctionComponent<TodayNumbersProps> = ({ data }) => {
  const spans = meetingSpans(data.meetings, DateTime.fromISO(data.day));
  const { done, planned } = doneOfPlanned(data.items, data.day);
  const types = [...noteTypeCounts(data.notes)]
    .filter(([type]) => type !== 0)
    .map(
      ([type, count]) =>
        `${count} ${(config[type] ?? config[0]).label.toLowerCase()}`,
    )
    .join(" · ");

  return (
    <Card
      size={"small"}
      variant={"borderless"}
      className={styles.flat}
      classNames={{ header: styles.flatPart, body: styles.flatPart }}
      title={"Today in numbers"}
    >
      <div className={styles.stack}>
        <div className={styles.numbers}>
          <Statistic
            title={`in meetings · ${spans.length} event${spans.length === 1 ? "" : "s"}`}
            value={formatMinutes(busyMinutes(spans))}
          />
          <div>
            <Statistic title={"notes"} value={data.notes.length} />
            {types && <span className={styles.meta}>{types}</span>}
          </div>
          <Statistic
            title={"planned items done"}
            value={planned ? `${done} / ${planned}` : "–"}
          />
        </div>
        <DayBar blocks={dayBarBlocks(spans)} />
      </div>
    </Card>
  );
};

export default TodayNumbers;
