import { Card, Tag } from "antd";
import { DateTime } from "luxon";
import React, { useRef } from "react";
import { blockedSpan, itemsOf } from "../../../utils/reviews";
import CalendarPane from "./CalendarPane";
import { type CalendarBlock, useBlockSource } from "./DayCalendar";
import PlanList from "./PlanList";
import PromptAnswer from "./PromptAnswer";
import { answersOf } from "./reviewHooks";
import styles from "./Review.module.css";
import SplitStep from "./SplitStep";
import type { WeeklyReviewData } from "./useWeeklyReview";

export interface PlanWeekStepProps {
  data: WeeklyReviewData;
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Next: kept at the foot of the plan. */
  footer: React.ReactNode;
}

const flat = {
  size: "small" as const,
  variant: "borderless" as const,
  className: styles.flat,
  classNames: { header: styles.flatPart, body: styles.flatPart },
};

/**
 * Step 4, split: next week's calendar on the left, at full height whether
 * it has meetings or not; on the right the theme, priorities, to-dos, what
 * was carried in, and start and stop. A priority's or to-do's title dragged
 * onto the calendar blocks 30 minutes for it; the block then moves (to
 * another day too) by dragging it, changes length by dragging its foot,
 * and comes off with its close button or by being dragged off the calendar.
 */
const PlanWeekStep: React.FunctionComponent<PlanWeekStepProps> = ({
  data,
  intro,
  footer,
}) => {
  const monday = DateTime.fromISO(data.nextMonday);
  const priorities = itemsOf(data.weekItems, data.nextMonday, "priority");
  const todos = itemsOf(data.weekItems, data.nextMonday, "todo");
  const planned = [...priorities, ...todos].filter(
    (i) => i.status !== "dropped" && i.status !== "carried",
  );
  const carriedIn = [...priorities, ...todos].filter((i) => i.carryCount > 0);
  const prompts = data.prompts.filter(
    (p) =>
      p.section === "plan" &&
      (!p.archived || data.review?.answers.some((a) => a.promptId === p.id)),
  );
  // The theme above the plan; the lists (start, stop) below it.
  const textPrompts = prompts.filter((p) => p.style !== "list");
  const listPrompts = prompts.filter((p) => p.style === "list");
  const disabled = !data.started;
  const count = priorities.length;

  const lists = useRef<HTMLDivElement>(null);
  useBlockSource(lists, disabled);

  const blocks: CalendarBlock[] = planned.flatMap((item) => {
    const span = blockedSpan(item);
    return span
      ? [
          {
            id: item.id,
            title: item.title,
            kind: item.kind,
            start: span.start.toJSDate(),
            end: span.end.toJSDate(),
          },
        ]
      : [];
  });
  const itemOf = (id: string) => planned.find((i) => i.id === id);
  const place = (id: string, start: Date, end: Date) => {
    const item = itemOf(id);
    const from = DateTime.fromJSDate(start);
    if (item) {
      void data.placeItem(item, {
        day: from.toISODate()!,
        start: from.toFormat("HH:mm"),
        end: DateTime.fromJSDate(end).toFormat("HH:mm"),
      });
    }
  };
  const unplace = (id: string) => {
    const item = itemOf(id);
    if (item) void data.placeItem(item, null);
  };
  const drop = (id: string, start: Date) => {
    const from = DateTime.fromJSDate(start);
    // Thirty minutes, or up to the end of its day.
    const to = from.plus({ minutes: 30 });
    const dayEnd = from.endOf("day").startOf("minute");
    place(id, start, (to > dayEnd ? dayEnd : to).toJSDate());
  };

  const prompt = (p: (typeof prompts)[number]) => (
    <Card key={p.id} {...flat}>
      <PromptAnswer
        prompt={p}
        answers={answersOf(data.review, p.id)}
        actions={data}
        todoFor={"next week"}
        disabled={disabled}
        rows={2}
      />
    </Card>
  );

  return (
    <SplitStep
      intro={intro}
      footer={footer}
      asideFirst={true}
      defaultSize={"55%"}
      hideScrollbar={true}
      aside={
        <CalendarPane
          fill={true}
          title={`Week of ${monday.toFormat("LLLL d")}`}
          day={data.nextMonday}
          days={7}
          meetings={data.nextMeetings}
          blocks={blocks}
          onBlockChange={disabled ? undefined : place}
          onBlockRemove={disabled ? undefined : unplace}
          onBlockDrop={disabled ? undefined : drop}
          note={"Drag a priority or to-do onto the calendar to block time."}
        />
      }
    >
      {textPrompts.map(prompt)}
      <div ref={lists} className={styles.stack}>
        <Card
          {...flat}
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
            blocks={true}
            blockDay={true}
            calendarDrag={true}
            placeholder={"Add a priority"}
            onAdd={(title) => data.addItem("priority", title)}
            onRemove={data.removeItem}
            onReorder={(ids) => data.reorderItems("priority", ids)}
          />
        </Card>
        <Card {...flat} title={"To-dos"}>
          <PlanList
            kind={"todo"}
            items={todos}
            disabled={disabled}
            blocks={true}
            blockDay={true}
            calendarDrag={true}
            placeholder={"Add a to-do"}
            onAdd={(title) => data.addItem("todo", title)}
            onRemove={data.removeItem}
            onReorder={(ids) => data.reorderItems("todo", ids)}
          />
        </Card>
      </div>
      <Card
        {...flat}
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
      {listPrompts.map(prompt)}
    </SplitStep>
  );
};

export default PlanWeekStep;
