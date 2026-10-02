import { Card, Tag } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { daysOfWeek, itemsOf } from "../../../utils/reviews";
import PlanList from "./PlanList";
import PlacePicker from "./PlacePicker";
import PromptAnswer from "./PromptAnswer";
import { answersOf } from "./reviewHooks";
import styles from "./Review.module.css";
import type { WeeklyReviewData } from "./useWeeklyReview";
import WeekGrid from "./WeekGrid";

export interface PlanWeekStepProps {
  data: WeeklyReviewData;
}

/**
 * Step 4: next week mapped out: its working days and their load, three to
 * five priorities placed on open time, to-dos, what was carried in, and
 * the theme, start and stop.
 */
const PlanWeekStep: React.FunctionComponent<PlanWeekStepProps> = ({ data }) => {
  const monday = DateTime.fromISO(data.nextMonday);
  const workDays = daysOfWeek(monday, 5);
  const priorities = itemsOf(data.weekItems, data.nextMonday, "priority");
  const todos = itemsOf(data.weekItems, data.nextMonday, "todo");
  const carriedIn = [...priorities, ...todos].filter((i) => i.carryCount > 0);
  const prompts = data.prompts.filter(
    (p) =>
      p.section === "plan" &&
      (!p.archived || data.review?.answers.some((a) => a.promptId === p.id)),
  );
  const disabled = !data.started;
  const count = priorities.length;

  return (
    <>
      <Card
        size={"small"}
        title={`Week of ${monday.toFormat("LLLL d")}`}
        extra={
          <span className={styles.meta}>drag a priority onto open time</span>
        }
      >
        <WeekGrid
          days={workDays}
          meetings={data.nextMeetings}
          priorities={priorities}
          disabled={disabled}
          onPlace={data.placeItem}
        />
      </Card>
      <div className={styles.columns}>
        <div className={styles.stack}>
          <Card
            size={"small"}
            title={"Priorities"}
            extra={
              <span className={styles.meta}>
                {count < 3
                  ? "three to five"
                  : count > 5
                    ? `${count}: more than five`
                    : `${count} of three to five`}
              </span>
            }
          >
            <PlanList
              kind={"priority"}
              items={priorities}
              disabled={disabled}
              placeholder={"Add a priority"}
              onAdd={(title) => data.addItem("priority", title)}
              onRemove={data.removeItem}
              onReorder={(ids) => data.reorderItems("priority", ids)}
              extra={(item) => (
                <PlacePicker
                  item={item}
                  days={daysOfWeek(monday)}
                  disabled={disabled}
                  onPlace={data.placeItem}
                />
              )}
            />
          </Card>
          <Card size={"small"} title={"To-dos"}>
            <PlanList
              kind={"todo"}
              items={todos}
              disabled={disabled}
              placeholder={"Add a to-do"}
              onAdd={(title) => data.addItem("todo", title)}
              onRemove={data.removeItem}
              onReorder={(ids) => data.reorderItems("todo", ids)}
            />
          </Card>
          <Card
            size={"small"}
            title={"Carried in"}
            extra={<span className={styles.meta}>{carriedIn.length}</span>}
          >
            {carriedIn.length === 0 ? (
              <span className={styles.meta}>
                Nothing yet: choose Next week for what slipped, in Look back.
              </span>
            ) : (
              carriedIn.map((item) => (
                <div key={item.id} className={styles.row}>
                  <span className={styles.rowMain}>{item.title}</span>
                  <Tag>{item.kind === "priority" ? "Priority" : "To-do"}</Tag>
                  <span className={styles.meta}>
                    carried {item.carryCount} time
                    {item.carryCount === 1 ? "" : "s"}
                  </span>
                </div>
              ))
            )}
          </Card>
        </div>
        <Card size={"small"} title={"The week's shape"}>
          <div className={styles.stack}>
            {prompts.map((prompt) => (
              <PromptAnswer
                key={prompt.id}
                prompt={prompt}
                answers={answersOf(data.review, prompt.id)}
                actions={data}
                todoFor={"next week"}
                disabled={disabled}
                rows={2}
              />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
};

export default PlanWeekStep;
