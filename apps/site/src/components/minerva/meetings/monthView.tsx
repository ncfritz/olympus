import { BarChartOutlined, CalendarOutlined } from "@ant-design/icons";
import type { EventClickArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import type { Meeting } from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";
import meetingsApi from "../../../api/meetingsApi";
import { Events, publish } from "../../../utils/events";
import { meetingsHref, periodOf } from "../../../utils/meetings";
import MeetingsDayPicker from "./MeetingsDayPicker";
import MeetingsPage from "./MeetingsPage";
import MeetingStatisticsPanel from "./MeetingsStatisticsPanel";

export interface MonthViewProps {
  /** A day in the month to show. */
  startDate: DateTime;
}

/** A month of meetings: the weeks it touches, Monday first. */
const MonthView: React.FunctionComponent<MonthViewProps> = ({ startDate }) => {
  const router = useRouter();
  const period = useMemo(() => periodOf("month", startDate), [startDate]);
  const [items, setItems] = useState<Meeting[]>();

  useEffect(() => {
    (async () => {
      try {
        const response = await meetingsApi.getMeetings(
          period.start,
          period.days,
        );
        setItems(response.data.items);
      } catch {
        setItems([]);
        publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
          type: "error",
          message: "Failed to load meetings",
          description: `Unable to fetch the meetings of ${startDate.toFormat("LLLL yyyy")}`,
        });
      }
    })();
  }, [period, startDate]);

  // All-day items crowd a month's cells; the day view shows them.
  const events = useMemo(
    () =>
      (items ?? [])
        .filter((item) => !item.isAllDay)
        .map((item) => meetingsApi.toEvent(item)),
    [items],
  );

  const handleEventClick = (arg: EventClickArg) => {
    const target = DateTime.fromJSDate(arg.event.start!);
    void router.push(
      `${meetingsHref("day", target)}?e=${encodeURIComponent(arg.event.id)}`,
    );
  };

  return (
    <MeetingsPage
      view={"month"}
      date={startDate}
      items={items}
      tabs={[
        {
          key: "calendar",
          label: <CalendarOutlined />,
          children: <MeetingsDayPicker view={"month"} date={startDate} />,
        },
        {
          key: "statistics",
          label: <BarChartOutlined />,
          children: (
            <MeetingStatisticsPanel
              startDate={period.from}
              dayCount={Math.round(period.to.diff(period.from, "days").days)}
            />
          ),
        },
      ]}
    >
      <FullCalendar
        viewClassNames={"minerva-cal minerva-cal-month"}
        plugins={[dayGridPlugin, interactionPlugin]}
        events={events}
        initialView={"dayGridMonth"}
        initialDate={startDate.toJSDate()}
        firstDay={1}
        fixedWeekCount={false}
        headerToolbar={false}
        height={"100%"}
        dayMaxEventRows={5}
        weekNumbers={true}
        weekNumberContent={(arg) => (
          <div className={"ribbon"}>Week&nbsp;{arg.num}</div>
        )}
        navLinks={true}
        navLinkDayClick={(date) =>
          void router.push(meetingsHref("day", DateTime.fromJSDate(date)))
        }
        navLinkWeekClick={(date) =>
          void router.push(meetingsHref("week", DateTime.fromJSDate(date)))
        }
        eventClick={handleEventClick}
        businessHours={{
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: "9:00",
          endTime: "17:00",
        }}
      />
    </MeetingsPage>
  );
};

export default MonthView;
