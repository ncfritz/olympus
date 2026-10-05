import {
  CalendarOutlined,
  HomeOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Space } from "antd";
import type { BreadcrumbItemType } from "antd/lib/breadcrumb/Breadcrumb";
import { DateTime, Interval } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import meetingsApi from "../../../api/meetingsApi";
import CollapsibleTabPanel from "../../layout/CollapsibleTabPanel";
import OlympusBreadcrumbs from "../../layout/OlympusBreadcrumbs";

export interface MonthViewProps {
  startDate: DateTime;
  breadcrumbs: Partial<BreadcrumbItemType>[];
}

const MonthView: React.FunctionComponent<MonthViewProps> = ({
  startDate,
  breadcrumbs,
}: MonthViewProps) => {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<FullCalendar>(null);
  // FullCalendar measures itself on window resizes only; opening the side
  // panel narrows it without one, and it would run on under the panel. It
  // is re-measured whenever its box changes size, as the review's is.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      calendarRef.current?.getApi().updateSize(),
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const [events, setEvents] = useState<EventInput[]>([]);

  const start = startDate.startOf("week");
  const end = startDate.endOf("month").endOf("week");
  const interval = Interval.fromDateTimes(start, end);
  // Whole days: the interval ends at 23:59:59.999, and the API takes a
  // whole number of days (41.99… was a 400).
  const days = Math.ceil(interval.length("days"));

  useEffect(() => {
    (async () => {
      const rawEvents = await meetingsApi.getMeetings(start, days);
      const parsedEvents: EventInput[] = [];

      rawEvents.data.items.forEach((rawEvent) => {
        const parsedEvent = meetingsApi.toEvent(rawEvent);

        if (!parsedEvent.allDay) {
          parsedEvents.push(parsedEvent);
        }
      });

      setEvents(parsedEvents);
    })();
  }, [startDate]);

  const handleDayClick = (date: Date) => {
    const target = DateTime.fromJSDate(date);
    const url = `/minerva/meetings/${target.year}/${target.toFormat("MM")}/${target.toFormat("dd")}`;

    router.push(url, url, { shallow: true });
  };

  const handleWeekClick = (date: Date) => {
    const target = DateTime.fromJSDate(date);
    const url = `/minerva/meetings/${target.year}/W${target.toFormat("WW")}`;

    router.push(url, url, { shallow: true });
  };

  const handleEventClick = (arg: EventClickArg) => {
    const target = DateTime.fromJSDate(arg.event.start!);
    const url = `/minerva/meetings/${target.year}/${target.toFormat("MM")}/${target.toFormat("dd")}?e=${encodeURIComponent(arg.event.id)}`;

    router.push(url, url, { shallow: true });
  };

  const sideTabs = [
    {
      key: "t-calendar",
      label: <CalendarOutlined />,
      children: (
        <Space orientation={"vertical"}>
          <Space
            size={8}
            className={"date-picker"}
            orientation={"vertical"}
            style={{ width: 390 }}
          >
            <Space
              style={{
                borderBottom: "1px solid #f6f6f6",
                width: "100%",
                justifyContent: "center",
              }}
            >
              <DayPicker
                className={"minerva-standard"}
                month={startDate.toJSDate()}
                toMonth={startDate.toJSDate()}
                showWeekNumber={true}
                showOutsideDays={true}
                onDayClick={() => {}}
                onMonthChange={() => {}}
                style={{
                  minWidth: 250,
                }}
              />
            </Space>
          </Space>
        </Space>
      ),
    },
  ];

  return (
    <>
      <OlympusBreadcrumbs
        className={"dark"}
        items={[
          {
            title: (
              <Link href={"/"}>
                <Space size={4}>
                  <HomeOutlined />
                  <span>Home</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/minerva"}>
                <Space size={4}>
                  <RadarChartOutlined />
                  <span>Minerva</span>
                </Space>
              </Link>
            ),
          },
          ...breadcrumbs,
        ]}
      />
      <CollapsibleTabPanel
        panelId={"meetings.side"}
        width={445}
        tabs={sideTabs}
        style={{
          width: "100%",
        }}
      >
        {/* Room on the left for the weeks' ribbons, which hang past the
            calendar's edge. */}
        <div
          ref={rootRef}
          style={{ height: "calc(100vh - 102px)", paddingLeft: 16 }}
        >
          <FullCalendar
            ref={calendarRef}
            viewClassNames={"minerva-cal minerva-cal-month"}
            plugins={[dayGridPlugin, interactionPlugin]}
            events={events}
            initialView="dayGridMonth"
            initialDate={startDate.toJSDate()}
            firstDay={1}
            headerToolbar={{
              start: "title",
              center: "",
              end: "",
            }}
            allDaySlot={false}
            height={"100%"}
            dayMaxEventRows={5}
            weekNumbers={true}
            weekNumberContent={(arg) => {
              return <div className={"ribbon"}>Week&nbsp;{arg.num}</div>;
            }}
            navLinks={true}
            navLinkDayClick={handleDayClick}
            navLinkWeekClick={handleWeekClick}
            eventClick={handleEventClick}
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5],
              startTime: "9:00",
              endTime: "17:00",
            }}
          />
        </div>
      </CollapsibleTabPanel>
    </>
  );
};
export default MonthView;
