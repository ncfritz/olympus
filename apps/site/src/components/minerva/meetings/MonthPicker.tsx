import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Flex, Typography } from "antd";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import styles from "./Meetings.module.css";

export interface MonthPickerProps {
  /** The month shown. */
  month: DateTime;
  onChange: (month: DateTime) => void;
  /** As wide as the date picker it stands in for. */
  width: number;
}

/**
 * A year's months, for the month of meetings, where the day and week have
 * a date picker: the year with its arrows, as the date picker has its
 * month, and the twelve months under it. This month is in bold, the one
 * shown is marked.
 */
const MonthPicker: React.FunctionComponent<MonthPickerProps> = ({
  month,
  onChange,
  width,
}: MonthPickerProps) => {
  const [year, setYear] = useState(month.year);
  const now = DateTime.now();

  // Back to the shown month's year when another month is shown.
  useEffect(() => setYear(month.year), [month.year]);

  const months = Array.from({ length: 12 }, (_, i) =>
    DateTime.fromObject({ year, month: i + 1 }),
  );

  return (
    <Flex
      vertical={true}
      gap={8}
      className={styles.monthPicker}
      // The side panel's width, from its one definition.
      // eslint-disable-next-line no-restricted-syntax
      style={{ width }}
    >
      <Flex justify={"space-between"} align={"center"}>
        <Typography.Text strong={true} className={styles.monthPickerYear}>
          {year}
        </Typography.Text>
        <Flex>
          <Button
            type={"text"}
            icon={<LeftOutlined />}
            aria-label={"Previous year"}
            onClick={() => setYear(year - 1)}
          />
          <Button
            type={"text"}
            icon={<RightOutlined />}
            aria-label={"Next year"}
            onClick={() => setYear(year + 1)}
          />
        </Flex>
      </Flex>
      <div className={styles.monthGrid}>
        {months.map((m) => {
          const shown = m.hasSame(month, "month");
          const current = m.hasSame(now, "month");
          return (
            <button
              key={m.month}
              type={"button"}
              className={[
                styles.month,
                shown ? styles.monthShown : "",
                current ? styles.monthCurrent : "",
              ].join(" ")}
              aria-pressed={shown}
              aria-label={m.toFormat("LLLL yyyy")}
              onClick={() => onChange(m)}
            >
              {m.toFormat("LLL")}
            </button>
          );
        })}
      </div>
    </Flex>
  );
};

export default MonthPicker;
