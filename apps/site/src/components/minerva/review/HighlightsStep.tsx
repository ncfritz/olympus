import { PushpinFilled, PushpinOutlined } from "@ant-design/icons";
import type { ReviewPin } from "@ncfritz/olympus-sdk/minerva";
import { Button, Card, Empty, Typography } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { config } from "../../../utils/notes";
import { answersByPrompt } from "../../../utils/reviews";
import { firstLine } from "./NoteList";
import styles from "./Review.module.css";
import type { WeeklyReviewData } from "./useWeeklyReview";

const { Text } = Typography;

export interface HighlightsStepProps {
  data: WeeklyReviewData;
}

/** Pins something to the week, or unpins it. */
const PinButton: React.FunctionComponent<{
  pin?: ReviewPin;
  disabled: boolean;
  onPin: () => Promise<void>;
  onUnpin: (pin: ReviewPin) => Promise<void>;
}> = ({ pin, disabled, onPin, onUnpin }) => (
  <Button
    size={"small"}
    type={pin ? "primary" : "text"}
    icon={pin ? <PushpinFilled /> : <PushpinOutlined />}
    disabled={disabled}
    aria-pressed={pin !== undefined}
    aria-label={pin ? "Unpin from the week" : "Pin to the week"}
    title={pin ? "Unpin from the week" : "Pin to the week"}
    onClick={() => void (pin ? onUnpin(pin) : onPin())}
  />
);

/**
 * Step 2: the week's daily answers under their prompts, and its flagged
 * notes. A pin keeps one with the week, beside Reflect and in Wrap up.
 */
const HighlightsStep: React.FunctionComponent<HighlightsStepProps> = ({
  data,
}) => {
  const groups = answersByPrompt(data.dailyPrompts, data.dailyReviews);
  const flagged = data.notes
    .filter((n) => n.flagged)
    .sort((a, b) => a.createdTime.localeCompare(b.createdTime));
  const disabled = !data.started;
  const pinOf = (target: { answerId?: string; noteId?: string }) =>
    data.pins.find((p) =>
      target.answerId
        ? p.answerId === target.answerId
        : p.noteId === target.noteId,
    );
  const day = (iso: string) => DateTime.fromISO(iso).toFormat("ccc");

  return (
    <>
      <div className={styles.threeColumns}>
        {groups.map(({ prompt, answers }) => (
          <Card
            key={prompt.id}
            size={"small"}
            title={prompt.label}
            extra={<span className={styles.meta}>{answers.length}</span>}
          >
            {answers.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={"Not answered this week"}
              />
            ) : (
              answers.map(({ day: on, answer }) => (
                <div key={answer.id} className={styles.row}>
                  <span className={styles.time}>{day(on)}</span>
                  <Text className={`${styles.rowMain} ${styles.answer}`}>
                    {answer.body}
                  </Text>
                  <PinButton
                    pin={pinOf({ answerId: answer.id })}
                    disabled={disabled}
                    onPin={() => data.pin({ answerId: answer.id })}
                    onUnpin={data.unpin}
                  />
                </div>
              ))
            )}
          </Card>
        ))}
      </div>
      <Card
        size={"small"}
        title={"Flagged notes"}
        extra={<span className={styles.meta}>{data.pins.length} pinned</span>}
      >
        {flagged.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={"No notes were flagged this week"}
          />
        ) : (
          flagged.map((note) => {
            const type = config[note.type] ?? config[0];
            return (
              <div key={note.id} className={styles.row}>
                <span className={styles.time}>{day(note.createdTime)}</span>
                <span
                  className={styles.dot}
                  style={{ background: type.color }}
                  aria-hidden={true}
                />
                <Text className={`${styles.rowMain} ${styles.ellipsis}`}>
                  {firstLine(note)}
                </Text>
                <span className={styles.meta}>{type.label}</span>
                <PinButton
                  pin={pinOf({ noteId: note.id })}
                  disabled={disabled}
                  onPin={() => data.pin({ noteId: note.id })}
                  onUnpin={data.unpin}
                />
              </div>
            );
          })
        )}
      </Card>
    </>
  );
};

export default HighlightsStep;
