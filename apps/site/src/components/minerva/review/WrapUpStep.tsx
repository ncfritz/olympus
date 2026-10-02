import { LockOutlined } from "@ant-design/icons";
import type { ReviewPrompt } from "@ncfritz/olympus-sdk/minerva";
import { Alert, Card } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { itemsOf, RATING_FIELDS } from "../../../utils/reviews";
import CalendarPane from "./CalendarPane";
import CalendarStep from "./CalendarStep";
import PlanList from "./PlanList";
import PromptAnswer from "./PromptAnswer";
import RatingInput from "./RatingInput";
import { answersOf } from "./reviewHooks";
import styles from "./Review.module.css";
import TodayNumbers from "./TodayNumbers";
import { tomorrowPlan } from "./tomorrowPlan";
import TriageList from "./TriageList";
import type { DailyReviewData } from "./useDailyReview";

export interface WrapUpStepProps {
  data: DailyReviewData;
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Complete: kept at the foot. */
  footer: React.ReactNode;
}

const flat = {
  size: "small" as const,
  variant: "borderless" as const,
  className: styles.flat,
  classNames: { header: styles.flatPart, body: styles.flatPart },
};

/**
 * Step 4: the review as it reads later, nothing in it changeable here, and
 * completing it. Three columns: today (its ratings, numbers, what became
 * of its plan, and the reflection), tomorrow (its priorities, to-dos and
 * thoughts), and tomorrow's calendar with the time they have blocked.
 * Today and tomorrow each scroll on their own under their headings.
 */
const WrapUpStep: React.FunctionComponent<WrapUpStepProps> = ({
  data,
  intro,
  footer,
}) => {
  const { review } = data;
  const answers = review?.answers ?? [];
  // Archived prompts are shown only where this review answered them.
  const promptsOf = (section: ReviewPrompt["section"]) =>
    data.prompts.filter(
      (p) =>
        p.section === section &&
        (!p.archived || answers.some((a) => a.promptId === p.id)),
    );
  const today = itemsOf(data.items, data.day);
  const { priorities, todos, blocks, openLine } = tomorrowPlan(data);
  const shown = (prompt: ReviewPrompt) => (
    <PromptAnswer
      key={prompt.id}
      prompt={prompt}
      answers={answersOf(review, prompt.id)}
      todoFor={"tomorrow"}
      readOnly={true}
    />
  );

  return (
    <CalendarStep
      side={"right"}
      limited={false}
      scroll={"parts"}
      intro={intro}
      footer={footer}
      calendar={
        <CalendarPane
          title={"Tomorrow's calendar"}
          day={data.tomorrow}
          meetings={data.tomorrowMeetings}
          blocks={blocks}
          note={openLine}
        />
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
            "Completing sets the ratings for the weekly trends. What you wrote stays editable; changes after today are marked."
          }
        />
      )}
      <div className={styles.wrapColumns}>
        <section
          className={`${styles.wrapColumn} ${styles.wrapToday}`}
          aria-label={"Today"}
        >
          <h2 className={styles.wrapHeading}>Today</h2>
          <div className={styles.wrapScroll}>
            <Card {...flat} title={"How was the day?"}>
              <div className={styles.stack}>
                {RATING_FIELDS.daily.map((field, index, fields) => (
                  <RatingInput
                    key={field.key}
                    field={field}
                    showEnds={index === fields.length - 1}
                    value={review?.[field.key]}
                    readOnly={true}
                  />
                ))}
              </div>
            </Card>
            <TodayNumbers data={data} />
            <Card {...flat} title={"Today's plan"}>
              <TriageList items={today} readOnly={true} onDecide={noop} />
            </Card>
            <Card {...flat} title={"Reflection"}>
              <div className={styles.stack}>
                {promptsOf("reflect").map(shown)}
              </div>
            </Card>
          </div>
        </section>
        <section className={styles.wrapColumn} aria-label={"Tomorrow"}>
          <h2 className={styles.wrapHeading}>Tomorrow</h2>
          <div className={styles.wrapScroll}>
            <Card {...flat} title={"Top priorities"}>
              {priorities.length ? (
                <PlanList
                  kind={"priority"}
                  items={priorities}
                  blocks={true}
                  readOnly={true}
                />
              ) : (
                <span className={styles.meta}>None planned</span>
              )}
            </Card>
            <Card {...flat} title={"To-dos"}>
              {todos.length ? (
                <PlanList
                  kind={"todo"}
                  items={todos}
                  blocks={true}
                  readOnly={true}
                />
              ) : (
                <span className={styles.meta}>None planned</span>
              )}
            </Card>
            {promptsOf("plan").map((prompt) => (
              <Card key={prompt.id} {...flat}>
                {shown(prompt)}
              </Card>
            ))}
          </div>
        </section>
      </div>
    </CalendarStep>
  );
};

const noop = async () => undefined;

export default WrapUpStep;
