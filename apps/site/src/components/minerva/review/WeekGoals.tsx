import type { Goal, GoalExecution } from "@ncfritz/olympus-sdk/minerva";
import { Empty, Progress, Statistic } from "antd";
import React from "react";
import { HEALTH } from "../../../utils/goals";
import { HealthTag, PaceBar } from "../goals/GoalBits";
import { EXECUTION_TARGET } from "../goals/SummaryStrip";
import styles from "./Review.module.css";

export interface WeekGoalsProps {
  goals: Goal[];
  execution?: GoalExecution;
}

/**
 * The goals beside the week: its habit execution against the target, and
 * each open goal's progress against its pace, those at risk or off track
 * first and flagged.
 */
const WeekGoals: React.FunctionComponent<WeekGoalsProps> = ({
  goals,
  execution,
}) => {
  const ordered = [...goals].sort(
    (a, b) =>
      (a.health ? HEALTH[a.health].rank : 3) -
        (b.health ? HEALTH[b.health].rank : 3) || a.position - b.position,
  );
  const habits = new Map(execution?.goals.map((g) => [g.goalId, g]) ?? []);
  return (
    <div className={styles.stack}>
      {execution && (
        <div className={styles.executionRow}>
          <Statistic
            title={"habit execution"}
            value={execution.score ?? "–"}
            suffix={execution.score !== undefined ? "%" : undefined}
          />
          <div className={styles.executionBar}>
            <Progress
              percent={execution.score ?? 0}
              showInfo={false}
              size={"small"}
              status={
                (execution.score ?? 0) >= EXECUTION_TARGET
                  ? "success"
                  : "normal"
              }
            />
            <span className={styles.meta}>
              {execution.done} of {execution.due} done · target{" "}
              {EXECUTION_TARGET}%
            </span>
          </div>
        </div>
      )}
      {ordered.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={"No open goals"}
        />
      ) : (
        <div>
          {ordered.map((goal) => {
            const habit = habits.get(goal.id);
            const flagged =
              goal.health === "at_risk" || goal.health === "off_track";
            return (
              <div key={goal.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.ellipsis}>{goal.title}</span>
                  <span className={styles.meta}>
                    {Math.round(goal.progress)}%
                    {goal.expectedProgress !== undefined &&
                      ` · pace ${Math.round(goal.expectedProgress)}%`}
                    {habit && ` · ${habit.done} of ${habit.due} this week`}
                  </span>
                </div>
                {flagged && <HealthTag health={goal.health} />}
                <PaceBar goal={goal} width={96} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WeekGoals;
