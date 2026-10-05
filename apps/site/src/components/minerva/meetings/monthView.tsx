import {
  CalendarOutlined,
  FilterOutlined,
  HomeOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import type { EventClickArg } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import type { Meeting } from "@ncfritz/olympus-sdk/minerva";
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
import useAvailabilityCalendar from "../../../hooks/useAvailabilityCalendar";
import CollapsibleTabPanel from "../../layout/CollapsibleTabPanel";
import OlympusBreadcrumbs from "../../layout/OlympusBreadcrumbs";
import MeetingsFilterPanel from "./availability/MeetingsFilterPanel";
import styles from "./Meetings.module.css";

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

  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const start = startDate.startOf("week");
  const end = startDate.endOf("month").endOf("week");
  const interval = Interval.fromDateTimes(start, end);
  // Whole days: the interval ends at 23:59:59.999, and the API takes a
  // whole number of days (41.99… was a 400).
  const days = Math.ceil(interval.length("days"));

  useEffect(() => {
    (async () => {
      const rawEvents = await meetingsApi.getMeetings(start, days);
      setMeetings(rawEvents.data.items);
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

  const calendar = useAvailabilityCalendar({
    meetings,
    start: start.toJSDate(),
    end: end.toJSDate(),
    // All-day meetings crowd a month's days; the day shows them.
    include: (meeting) => !meeting.isAllDay,
    onMeetingClick: handleEventClick,
  });

  const sideTabs = [
    {
      key: "t-calendar",
      label: <CalendarOutlined />,
      children: (
        <Space orientation={"vertical"}>
          <Space
            size={8}
            className={`date-picker ${styles.datePicker}`}
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
    {
      key: "t-filters",
      label: <FilterOutlined />,
      children: <MeetingsFilterPanel />,
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
            events={calendar.events}
            eventContent={calendar.eventContent}
            eventChange={calendar.eventChange}
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
            eventClick={calendar.eventClick}
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
