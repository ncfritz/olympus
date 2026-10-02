import type { ReviewItem } from "@ncfritz/olympus-sdk/minerva";
import { Card, Typography } from "antd";
import { DateTime } from "luxon";
import React from "react";
import {
  dayBarBlocks,
  formatSpan,
  itemsOf,
  type MeetingSpan,
  meetingSpans,
  openTime,
} from "../../../utils/reviews";
import DayBar from "./DayBar";
import MeetingList from "./MeetingList";
import PlanList from "./PlanList";
import PromptAnswer from "./PromptAnswer";
import styles from "./Review.module.css";
import type { DailyReviewData } from "./useDailyReview";

const { Text } = Typography;

export interface PlanTomorrowStepProps {
  data: DailyReviewData;
}

/** A priority's block of time as a span for the day bar. */
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

/** Step 3: tomorrow mapped out: its calendar, Top 3, to-dos and thoughts. */
const PlanTomorrowStep: React.FunctionComponent<PlanTomorrowStepProps> = ({
  data,
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

  return (
    <div className={styles.withCalendar}>
      <Card size={"small"} title={date.toFormat("cccc, LLLL d")}>
        <div className={styles.stack}>
          <DayBar blocks={dayBarBlocks(spans)} planned={dayBarBlocks(blocks)} />
          <MeetingList spans={spans} />
          <Text type={"secondary"}>
            {open.length
              ? `Open: ${open.map((g) => formatSpan(g.start, g.end)).join(" · ")}`
              : "No open time between 9:00 and 5:00 PM."}
          </Text>
        </div>
      </Card>
      <div className={styles.stack}>
        <Card
          size={"small"}
          title={"Top 3"}
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
            onBlock={data.blockItem}
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
        {prompts.map((prompt) => (
          <Card key={prompt.id} size={"small"}>
            <PromptAnswer
              prompt={prompt}
              answer={data.review?.answers.find(
                (a) => a.promptId === prompt.id,
              )}
              disabled={disabled}
              rows={3}
              onSave={(body) => data.saveAnswer(prompt.id, body)}
            />
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PlanTomorrowStep;
