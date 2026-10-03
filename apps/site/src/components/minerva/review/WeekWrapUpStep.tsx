import { LockOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Empty } from "antd";
import { DateTime } from "luxon";
import React from "react";
import {
  answeredPrompts,
  daysOfWeek,
  doneOfPlanned,
  formatMinutes,
  itemsOf,
  placeLabel,
  RATING_FIELDS,
  slippedItems,
  weekLoad,
} from "../../../utils/reviews";
import { pinnedHighlights } from "./pinned";
import PinnedList from "./PinnedList";
import AnswerBody from "./AnswerBody";
import styles from "./Review.module.css";
import type { WeeklyReviewData } from "./useWeeklyReview";

export interface WeekWrapUpStepProps {
  data: WeeklyReviewData;
  onEdit: (step: number) => void;
}

/** Step 5: how the review reads later, and completing it. */
const WeekWrapUpStep: React.FunctionComponent<WeekWrapUpStepProps> = ({
  data,
  onEdit,
}) => {
  const { review } = data;
  const answered = (section: "reflect" | "plan") =>
    answeredPrompts(data.prompts, review?.answers ?? [], section);
  const days = daysOfWeek(DateTime.fromISO(data.monday));
  const periods = data.days?.periods ?? [];
  const reviewed = periods.filter((p) => p.status === "complete").length;
  const due = periods.filter((p) => p.status !== "upcoming").length;
  const meetingMinutes = weekLoad(data.meetings, days, data.dayItems).reduce(
    (sum, d) => sum + d.meetingMinutes,
    0,
  );
  const { done, planned } = doneOfPlanned(data.weekItems, data.monday);
  const slipped = slippedItems(data.dayItems, days[0], data.today);
  const undecided = slipped.filter((i) => i.status === "open").length;
  const priorities = itemsOf(data.weekItems, data.nextMonday, "priority");
  const todos = itemsOf(data.weekItems, data.nextMonday, "todo");
  const ratings = RATING_FIELDS.weekly
    .map((f) => `${f.label} ${review?.[f.key] ?? "–"}`)
    .join(" · ");
  const edit = (step: number) => (
    <Button size={"small"} type={"link"} onClick={() => onEdit(step)}>
      Edit
    </Button>
  );

  return (
    <>
      <div className={styles.columns}>
        <Card size={"small"} title={"This week"} extra={edit(3)}>
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
                key: "pinned",
                label: "Pinned",
                children: <PinnedList highlights={pinnedHighlights(data)} />,
              },
              {
                key: "record",
                label: "Record",
                children: [
                  `${reviewed} of ${due} days reviewed`,
                  `${formatMinutes(meetingMinutes)} meetings`,
                  `${data.notes.length} notes`,
                  planned
                    ? `${done} of ${planned} priorities done`
                    : "no priorities planned",
                  undecided
                    ? `${undecided} slipped item${undecided === 1 ? "" : "s"} undecided`
                    : `${slipped.length} slipped`,
                ].join(" · "),
              },
            ]}
          />
        </Card>
        <Card size={"small"} title={"Next week"} extra={edit(4)}>
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
                ...answered("plan").map(({ prompt, answers }) => ({
                  key: prompt.id,
                  label: prompt.label,
                  children: <AnswerBody prompt={prompt} answers={answers} />,
                })),
                {
                  key: "priorities",
                  label: "Priorities",
                  children: priorities.length ? (
                    <ol>
                      {priorities.map((item) => {
                        const place = placeLabel(item);
                        return (
                          <li key={item.id}>
                            {item.title}
                            {place && ` (${place})`}
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
                    ? todos.map((t) => t.title).join(" · ")
                    : "None",
                },
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
            "Completing sets the week's ratings for the trends. Next week's theme and priorities show on Monday's daily review."
          }
        />
      )}
    </>
  );
};

export default WeekWrapUpStep;
