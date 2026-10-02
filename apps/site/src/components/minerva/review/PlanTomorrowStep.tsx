import { Draggable } from "@fullcalendar/interaction";
import { Card } from "antd";
import { DateTime } from "luxon";
import React, { useEffect, useRef } from "react";
import CalendarPane from "./CalendarPane";
import CalendarStep from "./CalendarStep";
import PlanList from "./PlanList";
import PromptAnswer from "./PromptAnswer";
import { answersOf } from "./reviewHooks";
import styles from "./Review.module.css";
import { tomorrowPlan } from "./tomorrowPlan";
import type { DailyReviewData } from "./useDailyReview";

export interface PlanTomorrowStepProps {
  data: DailyReviewData;
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Next: kept at the foot. */
  footer: React.ReactNode;
}

/**
 * Step 3: tomorrow mapped out: its calendar on the left with its open time
 * above, and beside it the top priorities, to-dos and thoughts. An item's
 * title dragged onto the calendar blocks 30 minutes for it there; the block
 * then moves by dragging it, changes length by dragging its foot, and comes
 * off with its close button or by being dragged off the calendar. Blocks
 * are drawn behind the meetings so they keep their place.
 */
const PlanTomorrowStep: React.FunctionComponent<PlanTomorrowStepProps> = ({
  data,
  intro,
  footer,
}) => {
  const date = DateTime.fromISO(data.tomorrow);
  const { priorities, todos, planned, blocks, openLine } = tomorrowPlan(data);
  const prompts = data.prompts.filter(
    (p) =>
      p.section === "plan" &&
      (!p.archived || data.review?.answers.some((a) => a.promptId === p.id)),
  );
  const disabled = !data.started;

  // A list item's title is dragged onto the calendar by FullCalendar's
  // Draggable, which drops a 30-minute block.
  const lists = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!lists.current || disabled) return;
    const draggable = new Draggable(lists.current, {
      itemSelector: "[data-block-item]",
      eventData: (el) => ({
        title: el.textContent ?? "",
        duration: "00:30",
        create: false,
      }),
    });
    return () => draggable.destroy();
  }, [disabled]);

  const clock = (time: Date) => DateTime.fromJSDate(time).toFormat("HH:mm");
  const itemOf = (id: string) => planned.find((i) => i.id === id);
  const place = (id: string, start: Date, end: Date) => {
    const item = itemOf(id);
    if (item)
      void data.blockItem(item, { start: clock(start), end: clock(end) });
  };
  const unplace = (id: string) => {
    const item = itemOf(id);
    if (item) void data.blockItem(item, null);
  };
  const drop = (id: string, start: Date) => {
    const from = DateTime.fromJSDate(start);
    const dayEnd = date.endOf("day");
    // Thirty minutes, or up to the end of the day.
    const to = from.plus({ minutes: 30 });
    place(id, start, (to > dayEnd ? dayEnd : to).toJSDate());
  };

  const flat = {
    size: "small" as const,
    variant: "borderless" as const,
    className: styles.flat,
    classNames: { header: styles.flatPart, body: styles.flatPart },
  };

  return (
    <CalendarStep
      intro={intro}
      footer={footer}
      calendar={
        <CalendarPane
          side={"left"}
          day={data.tomorrow}
          meetings={data.tomorrowMeetings}
          blocks={blocks}
          onBlockChange={disabled ? undefined : place}
          onBlockRemove={disabled ? undefined : unplace}
          onBlockDrop={disabled ? undefined : drop}
          note={openLine}
        />
      }
    >
      <div ref={lists} className={styles.stack}>
        <Card
          {...flat}
          title={"Top priorities"}
          extra={
            <span className={styles.meta}>
              the day is a win if these happen
            </span>
          }
        >
          <PlanList
            kind={"priority"}
            items={priorities}
            disabled={disabled}
            blocks={true}
            placeholder={"Add a priority"}
            onAdd={(title) => data.addItem("priority", title)}
            onRemove={data.removeItem}
            onReorder={(ids) => data.reorderItems("priority", ids)}
            calendarDrag={true}
          />
        </Card>
        <Card {...flat} title={"To-dos"}>
          <PlanList
            kind={"todo"}
            items={todos}
            disabled={disabled}
            blocks={true}
            placeholder={"Add a to-do"}
            onAdd={(title) => data.addItem("todo", title)}
            onRemove={data.removeItem}
            onReorder={(ids) => data.reorderItems("todo", ids)}
            calendarDrag={true}
          />
        </Card>
      </div>
      {prompts.map((prompt) => (
        <Card key={prompt.id} {...flat}>
          <PromptAnswer
            prompt={prompt}
            answers={answersOf(data.review, prompt.id)}
            actions={data}
            todoFor={"tomorrow"}
            disabled={disabled}
            rows={3}
          />
        </Card>
      ))}
    </CalendarStep>
  );
};

export default PlanTomorrowStep;
