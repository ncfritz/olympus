import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React from "react";
import { calendarWeeks, daysOfWeek } from "../../../utils/reviews";
import styles from "./Lists.module.css";

export interface MonthCalendarProps {
  month: DateTime;
  /** Steps to the month before or after. */
  onMonth: (month: DateTime) => void;
  /** Where a week's number goes, by its Monday; a week can be left unlinked. */
  weekHref: (monday: DateTime) => string | undefined;
  /** Whether a week is marked: the one listed, or a month's weeks. */
  marked: (monday: DateTime) => boolean;
  /** A day's dot: its colour, or hollow; none for no dot at all. */
  dot?: (day: DateTime) => { color?: string } | undefined;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * A month as a calendar with an ISO week column: a week's number links to
 * it, marked weeks are shaded, and each day can carry a dot.
 */
const MonthCalendar: React.FunctionComponent<MonthCalendarProps> = ({
  month,
  onMonth,
  weekHref,
  marked,
  dot,
}) => (
  <div className={styles.calendar}>
    <div className={styles.calendarHead}>
      <Button
        type={"text"}
        size={"small"}
        icon={<LeftOutlined />}
        aria-label={"The month before"}
        onClick={() => onMonth(month.minus({ months: 1 }))}
      />
      <span className={styles.calendarTitle}>
        {month.toFormat("LLLL yyyy")}
      </span>
      <Button
        type={"text"}
        size={"small"}
        icon={<RightOutlined />}
        aria-label={"The month after"}
        onClick={() => onMonth(month.plus({ months: 1 }))}
      />
    </div>
    <table className={styles.calendarGrid}>
      <thead>
        <tr>
          <th scope={"col"}>Wk</th>
          {WEEKDAYS.map((d) => (
            <th key={d} scope={"col"}>
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {calendarWeeks(month).map((monday) => {
          const href = weekHref(monday);
          const label = `W${monday.toFormat("WW")}`;
          return (
            <tr
              key={monday.toISODate()}
              className={marked(monday) ? styles.weekMarked : undefined}
            >
              <th scope={"row"}>
                {href ? (
                  <Link href={href} className={styles.weekLink}>
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </th>
              {daysOfWeek(monday).map((day) => {
                const shown = dot?.(day);
                const inMonth = day.month === month.month;
                return (
                  <td
                    key={day.toISODate()}
                    className={inMonth ? undefined : styles.outside}
                  >
                    <span className={styles.dayNumber}>{day.day}</span>
                    <span
                      className={
                        shown === undefined
                          ? styles.noDot
                          : shown.color
                            ? styles.dayDot
                            : styles.dayDotHollow
                      }
                      style={
                        shown?.color ? { background: shown.color } : undefined
                      }
                      aria-hidden={true}
                    />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default MonthCalendar;
