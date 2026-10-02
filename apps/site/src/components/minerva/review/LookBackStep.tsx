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
import DayReference from "./DayReference";
import styles from "./Review.module.css";
import SplitStep from "./SplitStep";
import TriageList from "./TriageList";
import type { DailyReviewData } from "./useDailyReview";
import WeekPlanCard from "./WeekPlanCard";

export interface LookBackStepProps {
  data: DailyReviewData;
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Next: kept at the foot of the left column. */
  footer: React.ReactNode;
}

/**
 * Step 1: the day as it happened, and a decision on everything planned
 * for it. The page's full width, split: the day in numbers and its plan on
 * the left over a footer that stays put; on the right its notes, which
 * scroll under their heading, beside its calendar at full height.
 */
const LookBackStep: React.FunctionComponent<LookBackStepProps> = ({
  data,
  intro,
  footer,
}) => {
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
    <SplitStep
      intro={intro}
      footer={footer}
      aside={
        <DayReference
          day={data.day}
          notes={data.notes}
          meetings={data.meetings}
        />
      }
    >
      {data.week && <WeekPlanCard week={data.week} />}
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
              value={kept ? `${done} / ${kept}` : "–"}
            />
          </div>
          <DayBar blocks={dayBarBlocks(spans)} />
        </div>
      </Card>
      <Card
        size={"small"}
        variant={"borderless"}
        className={styles.flat}
        classNames={{ header: styles.flatPart, body: styles.flatPart }}
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
    </SplitStep>
  );
};

export default LookBackStep;
