import { BarChartOutlined, CalendarOutlined } from "@ant-design/icons";
import type { EventClickArg } from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
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

export interface WeekViewProps {
  /** A day in the ISO week to show. */
  startDate: DateTime;
}

/** An ISO week of meetings, Monday to Sunday, in 15-minute slots. */
const WeekView: React.FunctionComponent<WeekViewProps> = ({ startDate }) => {
  const router = useRouter();
  const period = useMemo(() => periodOf("week", startDate), [startDate]);
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
          description: `Unable to fetch the meetings of week ${period.start.toFormat("WW")}`,
        });
      }
    })();
  }, [period]);

  const events = useMemo(
    () => (items ?? []).map((item) => meetingsApi.toEvent(item)),
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
      view={"week"}
      date={startDate}
      items={items}
      tabs={[
        {
          key: "calendar",
          label: <CalendarOutlined />,
          children: <MeetingsDayPicker view={"week"} date={startDate} />,
        },
        {
          key: "statistics",
          label: <BarChartOutlined />,
          children: (
            <MeetingStatisticsPanel
              startDate={period.start}
              dayCount={period.days}
            />
          ),
        },
      ]}
    >
      <FullCalendar
        viewClassNames={"minerva-cal minerva-cal-week"}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView={"timeGridWeek"}
        initialDate={period.start.toJSDate()}
        firstDay={1}
        headerToolbar={false}
        height={"100%"}
        events={events}
        businessHours={{
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: "9:00",
          endTime: "17:00",
        }}
        scrollTime={"08:00:00"}
        slotDuration={{ minutes: 15 }}
        nowIndicator={true}
        navLinks={true}
        navLinkDayClick={(date) =>
          void router.push(meetingsHref("day", DateTime.fromJSDate(date)))
        }
        eventClick={handleEventClick}
      />
    </MeetingsPage>
  );
};

export default WeekView;
