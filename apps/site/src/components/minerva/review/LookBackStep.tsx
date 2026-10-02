import { Card } from "antd";
import React from "react";
import { itemsOf, openCount } from "../../../utils/reviews";
import DayReference from "./DayReference";
import styles from "./Review.module.css";
import SplitStep from "./SplitStep";
import TodayNumbers from "./TodayNumbers";
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
  const planned = itemsOf(data.items, data.day);
  const left = openCount(data.items, data.day);

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
      <TodayNumbers data={data} />
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
