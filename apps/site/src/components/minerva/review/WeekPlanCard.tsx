import { Card, Descriptions } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React from "react";
import { weeklyReviewPath } from "../../../utils/reviews";
import { placeLabel } from "./PlacePicker";
import styles from "./Review.module.css";
import type { WeekPlan } from "./useDailyReview";

export interface WeekPlanCardProps {
  week: WeekPlan;
}

/** The week ahead as last week's review planned it, on Monday's review. */
const WeekPlanCard: React.FunctionComponent<WeekPlanCardProps> = ({ week }) => {
  const monday = week.priorities[0]?.periodStart;
  return (
    <Card
      size={"small"}
      title={"This week's plan"}
      extra={
        monday && (
          <Link
            href={weeklyReviewPath(
              DateTime.fromISO(monday).minus({ weeks: 1 }),
            )}
          >
            Last week's review
          </Link>
        )
      }
    >
      <Descriptions
        column={1}
        size={"small"}
        layout={"vertical"}
        colon={false}
        items={[
          ...week.answers.map((answer) => ({
            key: answer.id,
            label: answer.label,
            children: <span className={styles.answer}>{answer.body}</span>,
          })),
          ...(week.priorities.length
            ? [
                {
                  key: "priorities",
                  label: "Priorities",
                  children: (
                    <ol>
                      {week.priorities.map((item) => {
                        const place = placeLabel(item);
                        return (
                          <li key={item.id}>
                            {item.title}
                            {place && ` (${place})`}
                          </li>
                        );
                      })}
                    </ol>
                  ),
                },
              ]
            : []),
        ]}
      />
    </Card>
  );
};

export default WeekPlanCard;
