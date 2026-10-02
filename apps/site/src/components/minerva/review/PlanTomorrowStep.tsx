import type { ReviewItem } from "@ncfritz/olympus-sdk/minerva";
import { Card } from "antd";
import { DateTime } from "luxon";
import React from "react";
import {
  formatSpan,
  itemsOf,
  type MeetingSpan,
  meetingSpans,
  openTime,
} from "../../../utils/reviews";
import CalendarPane from "./CalendarPane";
import CalendarStep from "./CalendarStep";
import PlanList from "./PlanList";
import PromptAnswer from "./PromptAnswer";
import { answersOf } from "./reviewHooks";
import styles from "./Review.module.css";
import type { DailyReviewData } from "./useDailyReview";

export interface PlanTomorrowStepProps {
  data: DailyReviewData;
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Next: kept at the foot. */
  footer: React.ReactNode;
}

/** A priority's block of time as a span on its day. */
const blockSpan = (item: ReviewItem): MeetingSpan | undefined => {
  if (!item.scheduledStart || !item.scheduledEnd) return undefined;
  const at = (clock: string) =>
    DateTime.fromISO(`${item.periodStart}T${clock}`);
  return {
    meeting: {
      id: item.id,
      subject: item.title,
      startTime: at(item.scheduledStart).toISO()!,
      isAllDay: false,
      isDeleted: false,
      status: "Busy",
    },
    start: at(item.scheduledStart),
    end: at(item.scheduledEnd),
  };
};

/**
 * Step 3: tomorrow mapped out: its calendar on the left with the blocked
 * priorities drawn in and its open time above; Top 3, to-dos and thoughts
 * beside it.
 */
const PlanTomorrowStep: React.FunctionComponent<PlanTomorrowStepProps> = ({
  data,
  intro,
  footer,
}) => {
  const date = DateTime.fromISO(data.tomorrow);
  const spans = meetingSpans(data.tomorrowMeetings, date);
  const priorities = itemsOf(data.items, data.tomorrow, "priority");
  const todos = itemsOf(data.items, data.tomorrow, "todo");
  const blocks = priorities
    .map(blockSpan)
    .filter((span): span is MeetingSpan => span !== undefined);
  // Time already given to a priority is not open any more.
  const open = openTime(
    [...spans, ...blocks].sort(
      (a, b) => a.start.toMillis() - b.start.toMillis(),
    ),
    date,
  );
  const prompts = data.prompts.filter(
    (p) =>
      p.section === "plan" &&
      (!p.archived || data.review?.answers.some((a) => a.promptId === p.id)),
  );
  const disabled = !data.started;

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
          blocks={blocks.map((b) => ({
            id: b.meeting.id,
            title: b.meeting.subject,
            start: b.start.toJSDate(),
            end: b.end.toJSDate(),
          }))}
          note={
            open.length
              ? `Open: ${open.map((g) => formatSpan(g.start, g.end)).join(" · ")}`
              : "No open time between 9:00 and 5:00 PM."
          }
        />
      }
    >
      <Card
        {...flat}
        title={"Top 3"}
        extra={
          <span className={styles.meta}>the day is a win if these happen</span>
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
          onBlock={data.blockItem}
        />
      </Card>
      <Card {...flat} title={"To-dos"}>
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
