import { Alert, Card } from "antd";
import React from "react";
import { RATING_FIELDS } from "../../../utils/reviews";
import DayReference from "./DayReference";
import PromptAnswer from "./PromptAnswer";
import { answersOf } from "./reviewHooks";
import RatingInput from "./RatingInput";
import styles from "./Review.module.css";
import SplitStep from "./SplitStep";
import type { DailyReviewData } from "./useDailyReview";

export interface ReflectStepProps {
  data: DailyReviewData;
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Next: kept at the foot of the left column. */
  footer: React.ReactNode;
}

/**
 * Step 2: the day scored and the reflect prompts on the left; the day's
 * notes and calendar on the right, as Look back has them.
 */
const ReflectStep: React.FunctionComponent<ReflectStepProps> = ({
  data,
  intro,
  footer,
}) => {
  const { review } = data;
  const locked = review?.completed ?? false;
  const answers = review?.answers ?? [];
  // Archived prompts are no longer asked, unless this review answered them.
  const prompts = data.prompts.filter(
    (p) =>
      p.section === "reflect" &&
      (!p.archived || answers.some((a) => a.promptId === p.id)),
  );
  const flat = {
    size: "small" as const,
    variant: "borderless" as const,
    className: styles.flat,
    classNames: { header: styles.flatPart, body: styles.flatPart },
  };

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
      <Card
        {...flat}
        title={"How was the day?"}
        extra={<span className={styles.meta}>0.5 to 5</span>}
      >
        <div className={styles.stack}>
          {locked && (
            <Alert
              type={"info"}
              showIcon={true}
              title={"The review is complete, so its ratings are set."}
            />
          )}
          {RATING_FIELDS.daily.map((field, index, fields) => (
            <RatingInput
              key={field.key}
              field={field}
              showEnds={index === fields.length - 1}
              value={review?.[field.key]}
              disabled={locked || !data.started}
              onChange={(value) => void data.setRating(field.key, value)}
            />
          ))}
        </div>
      </Card>
      <Card {...flat} title={"Reflection"}>
        <div className={styles.stack}>
          {prompts.map((prompt) => (
            <PromptAnswer
              key={prompt.id}
              prompt={prompt}
              answers={answersOf(review, prompt.id)}
              actions={data}
              todoFor={"tomorrow"}
              disabled={!data.started}
              rows={3}
            />
          ))}
        </div>
      </Card>
    </SplitStep>
  );
};

export default ReflectStep;
