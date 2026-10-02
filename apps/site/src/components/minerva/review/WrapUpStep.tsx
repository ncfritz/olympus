import { LockOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Empty } from "antd";
import { DateTime } from "luxon";
import React from "react";
import {
  answeredPrompts,
  busyMinutes,
  doneOfPlanned,
  formatBlock,
  formatMinutes,
  itemsOf,
  meetingSpans,
  RATING_FIELDS,
} from "../../../utils/reviews";
import AnswerBody from "./AnswerBody";
import styles from "./Review.module.css";
import type { DailyReviewData } from "./useDailyReview";

export interface WrapUpStepProps {
  data: DailyReviewData;
  onEdit: (step: number) => void;
}

/** Step 4: how the review reads later, and completing it. */
const WrapUpStep: React.FunctionComponent<WrapUpStepProps> = ({
  data,
  onEdit,
}) => {
  const { review } = data;
  const answered = (section: "reflect" | "plan") =>
    answeredPrompts(data.prompts, review?.answers ?? [], section);
  const spans = meetingSpans(data.meetings, DateTime.fromISO(data.day));
  const { done, planned } = doneOfPlanned(data.items, data.day);
  const priorities = itemsOf(data.items, data.tomorrow, "priority");
  const todos = itemsOf(data.items, data.tomorrow, "todo");
  const ratings = RATING_FIELDS.daily
    .map((f) => `${f.label} ${review?.[f.key] ?? "–"}`)
    .join(" · ");

  return (
    <>
      <div className={styles.columns}>
        <Card
          size={"small"}
          title={"Today"}
          extra={
            <Button size={"small"} type={"link"} onClick={() => onEdit(2)}>
              Edit
            </Button>
          }
        >
          <Descriptions
            column={1}
            size={"small"}
            layout={"vertical"}
            colon={false}
            items={[
              { key: "ratings", label: "Ratings", children: ratings },
              ...answered("reflect").map(({ prompt, answers }) => ({
                key: prompt.id,
                label: prompt.label,
                children: <AnswerBody prompt={prompt} answers={answers} />,
              })),
              {
                key: "record",
                label: "Record",
                children: `${formatMinutes(busyMinutes(spans))} meetings · ${data.notes.length} notes · ${done} of ${planned} planned items done`,
              },
            ]}
          />
        </Card>
        <Card
          size={"small"}
          title={"Tomorrow"}
          extra={
            <Button size={"small"} type={"link"} onClick={() => onEdit(3)}>
              Edit
            </Button>
          }
        >
          {priorities.length + todos.length + answered("plan").length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={"Nothing planned yet"}
            />
          ) : (
            <Descriptions
              column={1}
              size={"small"}
              layout={"vertical"}
              colon={false}
              items={[
                {
                  key: "top",
                  label: "Top priorities",
                  children: priorities.length ? (
                    <ol>
                      {priorities.map((item) => {
                        const block = formatBlock(
                          item.scheduledStart,
                          item.scheduledEnd,
                        );
                        return (
                          <li key={item.id}>
                            {item.title}
                            {block && ` (${block})`}
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    "None"
                  ),
                },
                {
                  key: "todos",
                  label: "To-dos",
                  children: todos.length
                    ? todos
                        .map((t) => {
                          const block = formatBlock(
                            t.scheduledStart,
                            t.scheduledEnd,
                          );
                          return block ? `${t.title} (${block})` : t.title;
                        })
                        .join(" · ")
                    : "None",
                },
                ...answered("plan").map(({ prompt, answers }) => ({
                  key: prompt.id,
                  label: prompt.label,
                  children: <AnswerBody prompt={prompt} answers={answers} />,
                })),
              ]}
            />
          )}
        </Card>
      </div>
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
    </>
  );
};

export default WrapUpStep;
