import { Alert, Card } from "antd";
import React from "react";
import { RATING_FIELDS } from "../../../utils/reviews";
import { pinnedHighlights } from "./pinned";
import PinnedList from "./PinnedList";
import PromptAnswer from "./PromptAnswer";
import { answersOf } from "./reviewHooks";
import RatingInput from "./RatingInput";
import styles from "./Review.module.css";
import type { WeeklyReviewData } from "./useWeeklyReview";

export interface WeekReflectStepProps {
  data: WeeklyReviewData;
}

/** Step 3: the week scored, and the reflect prompts, beside its pins. */
const WeekReflectStep: React.FunctionComponent<WeekReflectStepProps> = ({
  data,
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

  return (
    <div className={styles.withRail}>
      <div className={styles.stack}>
        <Card
          size={"small"}
          title={"How was the week?"}
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
            {RATING_FIELDS.weekly.map((field) => (
              <RatingInput
                key={field.key}
                field={field}
                value={review?.[field.key]}
                disabled={locked || !data.started}
                onChange={(value) => void data.setRating(field.key, value)}
              />
            ))}
          </div>
        </Card>
        <Card size={"small"} title={"Reflection"}>
          <div className={styles.stack}>
            {prompts.map((prompt) => (
              <PromptAnswer
                key={prompt.id}
                prompt={prompt}
                answers={answersOf(review, prompt.id)}
                actions={data}
                todoFor={"next week"}
                disabled={!data.started}
                rows={3}
              />
            ))}
          </div>
        </Card>
      </div>
      <aside className={styles.stack} aria-label={"The week's pins"}>
        <span className={styles.railTitle}>Pinned this week</span>
        <Card size={"small"}>
          <PinnedList
            highlights={pinnedHighlights(data)}
            disabled={!data.started}
            onUnpin={(h) => data.unpin(h.pin)}
          />
        </Card>
      </aside>
    </div>
  );
};

export default WeekReflectStep;
