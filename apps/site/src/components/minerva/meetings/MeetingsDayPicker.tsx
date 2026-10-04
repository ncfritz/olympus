import type { GetMeetingSummaryResponse } from "@ncfritz/olympus-sdk/minerva";
import { Flex } from "antd";
import { DateTime } from "luxon";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";
import meetingsApi from "../../../api/meetingsApi";
import {
  meetingsHref,
  type MeetingsView,
  periodOf,
} from "../../../utils/meetings";
import Day from "./DayDoughnut";

export interface MeetingsDayPickerProps {
  view: MeetingsView;
  /** The day the page is of. */
  date: DateTime;
}

/**
 * The side panel's month: each day's meetings as a ring, the page's day or
 * week selected, Monday first with ISO week numbers. A day opens its day,
 * a week number its week.
 */
const MeetingsDayPicker: React.FunctionComponent<MeetingsDayPickerProps> = ({
  view,
  date,
}) => {
  const router = useRouter();
  const [month, setMonth] = useState(date.startOf("month"));
  const [summary, setSummary] = useState<GetMeetingSummaryResponse>();

  useEffect(() => {
    const { start, days } = periodOf("month", month);
    let current = true;
    meetingsApi
      .getSummary(start, days)
      .then((response) => current && setSummary(response.data))
      .catch(() => current && setSummary(undefined));
    return () => {
      current = false;
    };
  }, [month]);

  const { from, to } = periodOf(view === "month" ? "day" : view, date);
  const selected =
    view === "week"
      ? { from: from.toJSDate(), to: to.minus({ days: 1 }).toJSDate() }
      : view === "day"
        ? date.toJSDate()
        : undefined;

  return (
    <Flex justify={"center"} style={{ padding: "8px 0" }}>
      <DayPicker
        className={"minerva-standard"}
        mode={view === "week" ? "range" : "single"}
        selected={selected as never}
        month={month.toJSDate()}
        weekStartsOn={1}
        ISOWeek={true}
        showWeekNumber={true}
        showOutsideDays={true}
        formatters={{
          formatDay: (day: Date) => (
            <Day
              day={day.getDate()}
              types={
                summary?.statusStatistics?.[
                  DateTime.fromJSDate(day).toFormat("yyyy-MM-dd")
                ] ?? {}
              }
            />
          ),
        }}
        onDayClick={(day) =>
          void router.push(meetingsHref("day", DateTime.fromJSDate(day)))
        }
        onWeekNumberClick={(_week, dates) => {
          if (dates[0]) {
            void router.push(
              meetingsHref("week", DateTime.fromJSDate(dates[0])),
            );
          }
        }}
        onMonthChange={(next) =>
          setMonth(DateTime.fromJSDate(next).startOf("month"))
        }
        style={{ minWidth: 250 }}
      />
    </Flex>
  );
};

export default MeetingsDayPicker;
