import { FlagFilled, PushpinFilled, PushpinOutlined } from "@ant-design/icons";
import type { ReviewPin } from "@ncfritz/olympus-sdk/minerva";
import { Button, Card, Typography } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { config } from "../../../utils/notes";
import { answersByPrompt } from "../../../utils/reviews";
import DaySections, { byDay } from "./DaySections";
import { firstLine } from "./NoteList";
import styles from "./Review.module.css";
import SplitStep from "./SplitStep";
import type { WeeklyReviewData } from "./useWeeklyReview";

const { Text } = Typography;

export interface HighlightsStepProps {
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
 * Step 2, split: on the left the week's daily answers under their
 * prompts, on the right its notes, flagged ones marked; each by day, a
 * day only where it has some, opening and closing on its caret. A pin
 * keeps one with the week, beside Reflect and in Wrap up.
 */
const HighlightsStep: React.FunctionComponent<HighlightsStepProps> = ({
  data,
  intro,
  footer,
}) => {
  const groups = answersByPrompt(data.dailyPrompts, data.dailyReviews);
  const notes = [...data.notes].sort((a, b) =>
    a.createdTime.localeCompare(b.createdTime),
  );
  const disabled = !data.started;
  const pinOf = (target: { answerId?: string; noteId?: string }) =>
    data.pins.find((p) =>
      target.answerId
        ? p.answerId === target.answerId
        : p.noteId === target.noteId,
    );
  const noteDays = byDay(
    notes,
    (note) => DateTime.fromISO(note.createdTime).toISODate() ?? undefined,
    "",
  );

  return (
    <SplitStep
      intro={intro}
      footer={footer}
      hideScrollbar={true}
      aside={
        <div className={`${styles.asideScroll} ${styles.noScrollbar}`}>
          <Card
            {...flat}
            title={"Notes"}
            extra={
              <span className={styles.meta}>
                {notes.filter((n) => n.flagged).length} flagged ·{" "}
                {data.pins.length} pinned
              </span>
            }
          >
            <DaySections
              empty={"No notes this week"}
              sections={noteDays.map((group) => ({
                key: group.key,
                label: group.label,
                count: group.things.length,
                children: group.things.map((note) => {
                  const type = config[note.type] ?? config[0];
                  return (
                    <div key={note.id} className={styles.row}>
                      <span className={`${styles.time} ${styles.clockTime}`}>
                        {DateTime.fromISO(note.createdTime).toFormat("h:mm a")}
                      </span>
                      <span
                        className={styles.dot}
                        style={{ background: type.color }}
                        aria-hidden={true}
                      />
                      <Text className={`${styles.rowMain} ${styles.ellipsis}`}>
                        {firstLine(note)}
                      </Text>
                      {note.flagged && (
                        <FlagFilled
                          className={styles.flagged}
                          aria-label={"Flagged"}
                          title={"Flagged"}
                        />
                      )}
                      <span className={styles.meta}>{type.label}</span>
                      <PinButton
                        pin={pinOf({ noteId: note.id })}
                        disabled={disabled}
                        onPin={() => data.pin({ noteId: note.id })}
                        onUnpin={data.unpin}
                      />
                    </div>
                  );
                }),
              }))}
            />
          </Card>
        </div>
      }
    >
      {groups.map(({ prompt, answers }) => (
        <Card
          key={prompt.id}
          {...flat}
          title={prompt.label}
          extra={<span className={styles.meta}>{answers.length}</span>}
        >
          <DaySections
            empty={"Not answered this week"}
            sections={byDay(answers, (a) => a.day, "").map((group) => ({
              key: group.key,
              label: group.label,
              count: group.things.length,
              children: group.things.map(({ answer }) => (
                <div key={answer.id} className={styles.row}>
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
              )),
            }))}
          />
        </Card>
      ))}
    </SplitStep>
  );
};

export default HighlightsStep;
