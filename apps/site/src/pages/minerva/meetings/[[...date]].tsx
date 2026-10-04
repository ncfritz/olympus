import { DateTime } from "luxon";
import { useParams } from "next/navigation";
import React from "react";
import DayView from "../../../components/minerva/meetings/dayView";
import MonthView from "../../../components/minerva/meetings/monthView";
import WeekView from "../../../components/minerva/meetings/weekView";
import type { MeetingsView } from "../../../utils/meetings";

/**
 * Which view of which day a meetings URL names: /yyyy/MM/dd a day,
 * /kkkk/Www an ISO week, /yyyy/MM a month, /yyyy the year's first month,
 * and nothing (or anything unreadable) today.
 */
const viewOf = (parts: string[] | undefined): [MeetingsView, DateTime] => {
  const today = DateTime.now().startOf("day");
  const [first, second, third] = parts ?? [];
  const year = Number(first);
  let parsed: [MeetingsView, DateTime] | undefined;
  if (parts?.length === 3) {
    parsed = [
      "day",
      DateTime.fromObject({ year, month: Number(second), day: Number(third) }),
    ];
  } else if (parts?.length === 2 && /^w\d{1,2}$/i.test(second)) {
    parsed = [
      "week",
      DateTime.fromObject({
        weekYear: year,
        weekNumber: Number(second.slice(1)),
      }),
    ];
  } else if (parts?.length === 2) {
    parsed = ["month", DateTime.fromObject({ year, month: Number(second) })];
  } else if (parts?.length === 1) {
    parsed = ["month", DateTime.fromObject({ year, month: 1 })];
  }
  return parsed && parsed[1].isValid ? parsed : ["day", today];
};

const MeetingsIndexPage: React.FunctionComponent = () => {
  const params = useParams<{ date: string[] }>();
  const [view, date] = viewOf(params?.date);

  // Keyed by what they show, so moving to another day, week or month starts
  // the view over rather than keeping the last one's state.
  const key = `${view}-${date.toISODate()}`;
  if (view === "week") return <WeekView key={key} startDate={date} />;
  if (view === "month") return <MonthView key={key} startDate={date} />;
  return <DayView key={key} startDate={date} />;
};

export default MeetingsIndexPage;
