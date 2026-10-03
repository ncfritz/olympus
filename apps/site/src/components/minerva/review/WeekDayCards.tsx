import type { ReviewPeriodSummary } from "@ncfritz/olympus-sdk/minerva";
import { Button, Rate, Tag } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React from "react";
import {
  dailyReviewPath,
  RATING_FIELDS,
  type RatingField,
} from "../../../utils/reviews";
import styles from "./Review.module.css";

const STATUS: Record<
  ReviewPeriodSummary["status"],
  { label: string; color?: string; action?: string }
> = {
  complete: { label: "Complete", color: "green", action: "Read review" },
  draft: { label: "Draft", color: "orange", action: "Continue review" },
  missed: { label: "No review", color: "red", action: "Start review" },
  open: { label: "Today", color: "blue", action: "Review today" },
  upcoming: { label: "Upcoming" },
};

export interface WeekDayCardsProps {
  periods: ReviewPeriodSummary[];
  disabled?: boolean;
  /** A day's rating set from its card; null clears it. */
  onRate: (
    day: string,
    key: RatingField["key"],
    value: number | null,
  ) => Promise<void>;
}

/** A rating as a row of small circles, in halves, as Reflect draws it. */
const MiniRating: React.FunctionComponent<{
  field: RatingField;
  value?: number;
  day: string;
  disabled: boolean;
  onChange: (value: number | null) => void;
}> = ({ field, value, day, disabled, onChange }) => (
  <div className={styles.miniRating}>
    <span className={styles.miniLabel}>{field.label}</span>
    <Rate
      className={`${styles.rate} ${styles.miniRate}`}
      allowHalf={true}
      disabled={disabled}
      value={value ?? 0}
      character={<span className={styles.miniDot} />}
      aria-label={`${field.label} for ${day}`}
      onChange={(rating) => onChange(rating || null)}
    />
    <span className={styles.miniValue}>{value?.toFixed(1) ?? "–"}</span>
  </div>
);

/**
 * The week's days, a card each: its review status across the top, the
 * date and overall score, each rating as small circles that set it (a
 * completed day's are set), and its daily review at the foot.
 */
const WeekDayCards: React.FunctionComponent<WeekDayCardsProps> = ({
  periods,
  disabled = false,
  onRate,
}) => (
  <div className={styles.dayCards}>
    {periods.map((period) => {
      const day = DateTime.fromISO(period.periodStart);
      const status = STATUS[period.status];
      const overall = period.ratings.overall;
      const locked =
        disabled ||
        period.status === "complete" ||
        period.status === "upcoming";
      return (
        <section
          key={period.periodStart}
          className={styles.dayCard}
          aria-label={day.toFormat("cccc d")}
        >
          <Tag className={styles.dayStatus} color={status.color}>
            {status.label}
          </Tag>
          <div className={styles.dayCardBody}>
            <div className={styles.dayCardHead}>
              <strong className={styles.nowrap}>{day.toFormat("ccc d")}</strong>
              <span className={styles.score}>{overall?.toFixed(1) ?? "–"}</span>
            </div>
            {RATING_FIELDS.daily.map((field) => (
              <MiniRating
                key={field.key}
                field={field}
                day={day.toFormat("cccc")}
                value={period.ratings[field.key]}
                disabled={locked}
                onChange={(value) =>
                  void onRate(period.periodStart, field.key, value)
                }
              />
            ))}
          </div>
          {status.action && (
            <Link href={dailyReviewPath(day)} className={styles.dayAction}>
              <Button type={"text"} block={true} tabIndex={-1}>
                {status.action}
              </Button>
            </Link>
          )}
        </section>
      );
    })}
  </div>
);

export default WeekDayCards;
