import { Alert, Card } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { meetingSpans, RATING_FIELDS } from "../../../utils/reviews";
import MeetingList from "./MeetingList";
import NoteList from "./NoteList";
import PromptAnswer from "./PromptAnswer";
import { answersOf } from "./reviewHooks";
import RatingInput from "./RatingInput";
import styles from "./Review.module.css";
import type { DailyReviewData } from "./useDailyReview";

export interface ReflectStepProps {
  data: DailyReviewData;
}

/** Step 2: the day scored, and the reflect prompts, beside its record. */
const ReflectStep: React.FunctionComponent<ReflectStepProps> = ({ data }) => {
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
          title={"How was the day?"}
          extra={<span className={styles.meta}>1 = low · 5 = high</span>}
        >
          <div className={styles.stack}>
            {locked && (
              <Alert
                type={"info"}
                showIcon={true}
                title={"The review is complete, so its ratings are set."}
              />
            )}
            {RATING_FIELDS.daily.map((field) => (
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
                todoFor={"tomorrow"}
                disabled={!data.started}
                rows={3}
              />
            ))}
          </div>
        </Card>
      </div>
      <aside className={styles.stack} aria-label={"The day, for reference"}>
        <span className={styles.railTitle}>For reference</span>
        <Card size={"small"} title={"Calendar"}>
          <MeetingList
            spans={meetingSpans(data.meetings, DateTime.fromISO(data.day))}
            limit={4}
          />
        </Card>
        <Card size={"small"} title={"Notes"}>
          <NoteList notes={data.notes} limit={4} />
        </Card>
      </aside>
    </div>
  );
};

export default ReflectStep;
