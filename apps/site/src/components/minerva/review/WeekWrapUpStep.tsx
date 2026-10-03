import { LockOutlined } from "@ant-design/icons";
import type { ReviewPrompt } from "@ncfritz/olympus-sdk/minerva";
import { Alert, Card, Tag, Typography } from "antd";
import { DateTime } from "luxon";
import React from "react";
import {
  answersByPrompt,
  blockedSpan,
  itemsOf,
  RATING_FIELDS,
} from "../../../utils/reviews";
import AnswerList from "./AnswerList";
import DayCalendar, { type CalendarBlock } from "./DayCalendar";
import DaySections, { byDay } from "./DaySections";
import PlanList from "./PlanList";
import PromptAnswer from "./PromptAnswer";
import RatingInput from "./RatingInput";
import { answersOf } from "./reviewHooks";
import styles from "./Review.module.css";
import SplitStep from "./SplitStep";
import type { WeeklyReviewData } from "./useWeeklyReview";
import WeekTime from "./WeekTime";

const { Text } = Typography;

/** The hours next week's calendar shows: the working day. */
const CORE_HOURS: [number, number] = [8, 18];

export interface WeekWrapUpStepProps {
  data: WeeklyReviewData;
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Complete: kept at the foot of the left column. */
  footer: React.ReactNode;
}

const flat = {
  size: "small" as const,
  variant: "borderless" as const,
  className: styles.flat,
  classNames: { header: styles.flatPart, body: styles.flatPart },
};

/**
 * Step 5, split, nothing changeable but the review's completion. Left: the
 * week's time, and its daily answers under their prompts, each prompt
 * folding on its caret, its days as small headings over items that all
 * line up. Right: the week's ratings, next week's calendar over the
 * working day, its theme, and its plan, each part folding on its caret.
 */
const WeekWrapUpStep: React.FunctionComponent<WeekWrapUpStepProps> = ({
  data,
  intro,
  footer,
}) => {
  const { review } = data;
  const daily = answersByPrompt(data.dailyPrompts, data.dailyReviews);
  const priorities = itemsOf(data.weekItems, data.nextMonday, "priority");
  const todos = itemsOf(data.weekItems, data.nextMonday, "todo");
  const carriedIn = [...priorities, ...todos].filter((i) => i.carryCount > 0);
  const prompts = data.prompts.filter(
    (p) =>
      p.section === "plan" &&
      (!p.archived || review?.answers.some((a) => a.promptId === p.id)),
  );
  const textPrompts = prompts.filter((p) => p.style !== "list");
  const listPrompts = prompts.filter((p) => p.style === "list");
  const blocks: CalendarBlock[] = [...priorities, ...todos]
    .filter((i) => i.status !== "dropped" && i.status !== "carried")
    .flatMap((item) => {
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
  const none = (what: string) => <Text type={"secondary"}>{what}</Text>;
  const listOf = (prompt: ReviewPrompt) => {
    const items = answersOf(review, prompt.id);
    return {
      key: prompt.id,
      label: prompt.label,
      count: items.length,
      children: items.length ? (
        <AnswerList
          label={prompt.label}
          items={items}
          todoFor={"next week"}
          readOnly={true}
        />
      ) : (
        none("Nothing added")
      ),
    };
  };

  return (
    <SplitStep
      intro={intro}
      footer={footer}
      hideScrollbar={true}
      aside={
        <div className={`${styles.asideScroll} ${styles.noScrollbar}`}>
          <Card {...flat} title={"How was the week?"}>
            <div className={styles.stack}>
              {RATING_FIELDS.weekly.map((field) => (
                <RatingInput
                  key={field.key}
                  field={field}
                  value={review?.[field.key]}
                  readOnly={true}
                />
              ))}
            </div>
          </Card>
          <Card
            {...flat}
            title={`Week of ${DateTime.fromISO(data.nextMonday).toFormat("LLLL d")}`}
          >
            <DayCalendar
              day={data.nextMonday}
              days={7}
              hours={CORE_HOURS}
              meetings={data.nextMeetings}
              blocks={blocks}
            />
          </Card>
          {textPrompts.map((prompt) => (
            <Card key={prompt.id} {...flat}>
              <PromptAnswer
                prompt={prompt}
                answers={answersOf(review, prompt.id)}
                todoFor={"next week"}
                readOnly={true}
              />
            </Card>
          ))}
          <DaySections
            empty={"Nothing planned yet"}
            sections={[
              {
                key: "priorities",
                label: "Priorities",
                count: priorities.length,
                children: priorities.length ? (
                  <PlanList
                    kind={"priority"}
                    items={priorities}
                    blocks={true}
                    blockDay={true}
                    readOnly={true}
                  />
                ) : (
                  none("None planned")
                ),
              },
              {
                key: "todos",
                label: "To-dos",
                count: todos.length,
                children: todos.length ? (
                  <PlanList
                    kind={"todo"}
                    items={todos}
                    blocks={true}
                    blockDay={true}
                    readOnly={true}
                  />
                ) : (
                  none("None planned")
                ),
              },
              {
                key: "carried",
                label: "Carried in",
                count: carriedIn.length,
                children: carriedIn.length
                  ? carriedIn.map((item) => (
                      <div key={item.id} className={styles.row}>
                        <span className={styles.rowMain}>{item.title}</span>
                        <Tag>
                          {item.kind === "priority" ? "Priority" : "To-do"}
                        </Tag>
                        <span className={styles.meta}>
                          carried {item.carryCount} time
                          {item.carryCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    ))
                  : none("Nothing carried in"),
              },
              ...listPrompts.map(listOf),
            ]}
          />
        </div>
      }
    >
      {review?.completed ? (
        <Alert
          type={"success"}
          showIcon={true}
          title={`Completed ${DateTime.fromISO(review.completedTime!).toFormat("ccc d LLL 'at' h:mm a")}. The ratings are set; answers can still change and are marked as edited later.`}
        />
      ) : (
        <Alert
          type={"info"}
          showIcon={true}
          icon={<LockOutlined />}
          title={
            "Completing sets the week's ratings for the trends. Next week's theme and priorities show on Monday's daily review."
          }
        />
      )}
      <Card {...flat} title={"Time"}>
        <WeekTime data={data} />
      </Card>
      <DaySections
        empty={"No daily prompts"}
        sections={daily.map(({ prompt, answers }) => ({
          key: prompt.id,
          label: prompt.label,
          count: answers.length,
          children: answers.length
            ? byDay(answers, (a) => a.day, "").map((day) => (
                <div key={day.key}>
                  <div className={styles.dayLabel}>{day.label}</div>
                  {day.things.map(({ answer }) => (
                    <div key={answer.id} className={styles.row}>
                      <Text className={`${styles.rowMain} ${styles.answer}`}>
                        {answer.body}
                      </Text>
                    </div>
                  ))}
                </div>
              ))
            : none("Not answered this week"),
        }))}
      />
    </SplitStep>
  );
};

export default WeekWrapUpStep;
