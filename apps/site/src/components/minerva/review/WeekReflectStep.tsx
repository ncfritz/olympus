import { Alert, Card } from "antd";
import React from "react";
import { RATING_FIELDS } from "../../../utils/reviews";
import DaySections from "./DaySections";
import { type PinnedHighlight, pinnedHighlights } from "./pinned";
import PinnedList from "./PinnedList";
import PromptAnswer from "./PromptAnswer";
import { answersOf } from "./reviewHooks";
import RatingInput from "./RatingInput";
import styles from "./Review.module.css";
import SplitStep from "./SplitStep";
import type { WeeklyReviewData } from "./useWeeklyReview";
import WeekDayCards from "./WeekDayCards";
import WeekTime from "./WeekTime";

export interface WeekReflectStepProps {
  data: WeeklyReviewData;
  /** What the step asks, above its content. */
  intro: string;
  /** Back, Save and exit, Next: kept at the foot of the left column. */
  footer: React.ReactNode;
}

const flat = {
  size: "small" as const,
  variant: "borderless" as const,
  className: styles.flat,
  classNames: { header: styles.flatPart, body: styles.flatPart },
};

/**
 * The pins by where they came from: the daily prompts in their order,
 * then the notes by type, named as plurals ("Notes", "Question notes").
 */
const byCategory = (
  highlights: PinnedHighlight[],
  promptOrder: string[],
): { key: string; label: string; highlights: PinnedHighlight[] }[] => {
  const groups = new Map<string, PinnedHighlight[]>();
  for (const h of highlights) {
    groups.set(h.source, [...(groups.get(h.source) ?? []), h]);
  }
  const rank = (source: string) => {
    const at = promptOrder.indexOf(source);
    return at === -1 ? promptOrder.length : at;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([key, grouped]) => ({
      key,
      label: grouped[0]?.pin.noteId
        ? key === "Note note"
          ? "Notes"
          : `${key}s`
        : key,
      highlights: grouped,
    }));
};

/**
 * Step 3, split: on the left the week's days as Look back shows them,
 * read only, the week scored, and the reflect prompts; on the right its
 * time and its pins by category, each opening and closing on its caret.
 */
const WeekReflectStep: React.FunctionComponent<WeekReflectStepProps> = ({
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
  const categories = byCategory(
    pinnedHighlights(data),
    [...data.dailyPrompts]
      .sort((a, b) => a.position - b.position)
      .map((p) => p.label),
  );

  return (
    <SplitStep
      intro={intro}
      footer={footer}
      defaultSize={"60%"}
      hideScrollbar={true}
      aside={
        <div className={`${styles.asideScroll} ${styles.noScrollbar}`}>
          <Card {...flat} title={"Time"}>
            <WeekTime data={data} />
          </Card>
          <Card
            {...flat}
            title={"Pinned this week"}
            extra={<span className={styles.meta}>{data.pins.length}</span>}
          >
            <DaySections
              empty={"Nothing pinned"}
              sections={categories.map((category) => ({
                key: category.key,
                label: category.label,
                count: category.highlights.length,
                children: (
                  <PinnedList
                    highlights={category.highlights}
                    showSource={false}
                    disabled={!data.started}
                    onUnpin={(h) => data.unpin(h.pin)}
                  />
                ),
              }))}
            />
          </Card>
        </div>
      }
    >
      <WeekDayCards periods={data.days?.periods ?? []} readOnly={true} />
      <Card
        {...flat}
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
      <Card {...flat} title={"Reflection"}>
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
    </SplitStep>
  );
};

export default WeekReflectStep;
