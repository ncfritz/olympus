import type { ReviewPeriodSummary } from "@ncfritz/olympus-sdk/minerva";
import { Card, Select, Tag } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React from "react";
import { dailyReviewPath } from "../../../utils/reviews";
import styles from "./Review.module.css";

const STATUS: Record<
  ReviewPeriodSummary["status"],
  { label: string; color?: string }
> = {
  complete: { label: "Complete", color: "green" },
  draft: { label: "Draft", color: "orange" },
  missed: { label: "No review", color: "red" },
  open: { label: "Today", color: "blue" },
  upcoming: { label: "Upcoming" },
};

export interface WeekDayCardsProps {
  periods: ReviewPeriodSummary[];
  disabled?: boolean;
  onQuickScore: (day: string, overall: number) => Promise<void>;
}

/**
 * The week's days, a card each: its overall rating, headline and review
 * status, linking to its daily review. A missed day can be scored in a
 * click, or reviewed in full.
 */
const WeekDayCards: React.FunctionComponent<WeekDayCardsProps> = ({
  periods,
  disabled = false,
  onQuickScore,
}) => (
  <div className={styles.dayCards}>
    {periods.map((period) => {
      const day = DateTime.fromISO(period.periodStart);
      const status = STATUS[period.status];
      const overall = period.ratings.overall;
      return (
        <Card key={period.periodStart} size={"small"}>
          <div className={styles.dayCard}>
            <strong className={styles.nowrap}>{day.toFormat("ccc d")}</strong>
            <span>
              <Tag color={status.color}>{status.label}</Tag>
            </span>
            {period.status === "missed" ? (
              <>
                <Select
                  size={"small"}
                  placeholder={"Quick score"}
                  aria-label={`Quick score for ${day.toFormat("cccc")}`}
                  disabled={disabled}
                  options={[1, 2, 3, 4, 5].map((n) => ({
                    label: `Overall ${n}`,
                    value: n,
                  }))}
                  onChange={(value: number) =>
                    void onQuickScore(period.periodStart, value)
                  }
                />
                <Link href={dailyReviewPath(day)}>Full review</Link>
              </>
            ) : period.status === "upcoming" ? (
              <span className={styles.meta}>Not yet</span>
            ) : (
              <>
                <span className={styles.score}>
                  {overall ?? "–"}
                  <span className={styles.meta}> overall</span>
                </span>
                {period.headline && (
                  <span className={styles.headline}>{period.headline}</span>
                )}
                <Link href={dailyReviewPath(day)}>
                  {period.status === "complete"
                    ? "Read review"
                    : period.status === "open"
                      ? "Review today"
                      : "Continue review"}
                </Link>
              </>
            )}
          </div>
        </Card>
      );
    })}
  </div>
);

export default WeekDayCards;
