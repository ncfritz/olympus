import { Card, Statistic } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { config } from "../../../utils/notes";
import {
  busyMinutes,
  dayBarBlocks,
  doneOfPlanned,
  formatMinutes,
  itemsOf,
  meetingSpans,
  noteTypeCounts,
  openCount,
} from "../../../utils/reviews";
import DayBar from "./DayBar";
import MeetingList from "./MeetingList";
import NoteList from "./NoteList";
import styles from "./Review.module.css";
import TriageList from "./TriageList";
import type { DailyReviewData } from "./useDailyReview";

export interface LookBackStepProps {
  data: DailyReviewData;
}

/** Step 1: the day as it happened, and a decision on everything planned for it. */
const LookBackStep: React.FunctionComponent<LookBackStepProps> = ({ data }) => {
  const date = DateTime.fromISO(data.day);
  const spans = meetingSpans(data.meetings, date);
  const planned = itemsOf(data.items, data.day);
  const { done, planned: kept } = doneOfPlanned(data.items, data.day);
  const left = openCount(data.items, data.day);
  const types = [...noteTypeCounts(data.notes)]
    .filter(([type]) => type !== 0)
    .map(
      ([type, count]) =>
        `${count} ${(config[type] ?? config[0]).label.toLowerCase()}`,
    )
    .join(" · ");

  return (
    <>
      <Card size={"small"} title={"Today in numbers"}>
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
              value={kept ? `${done} / ${kept}` : "–"}
            />
          </div>
          <DayBar blocks={dayBarBlocks(spans)} />
        </div>
      </Card>
      <div className={styles.columns}>
        <Card size={"small"} title={"Calendar"}>
          <MeetingList spans={spans} />
        </Card>
        <Card size={"small"} title={"Notes"}>
          <NoteList notes={data.notes} />
        </Card>
      </div>
      <Card
        size={"small"}
        title={"Today's plan"}
        extra={
          <span className={styles.meta}>
            {left ? `${left} left open` : planned.length ? "All decided" : ""}
          </span>
        }
      >
        <TriageList
          items={planned}
          disabled={!data.started}
          onDecide={data.triage}
        />
      </Card>
    </>
  );
};

export default LookBackStep;
