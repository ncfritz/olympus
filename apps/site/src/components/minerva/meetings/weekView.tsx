import type {
  GetMeetingSummaryResponse,
  Meeting,
} from "@ncfritz/olympus-sdk/minerva";
import {
  CalendarOutlined,
  HomeOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import type { EventClickArg } from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Space, Tabs } from "antd";
import type { BreadcrumbItemType } from "antd/lib/breadcrumb/Breadcrumb";
import { DateTime, Interval } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import { type DateRange, DayPicker } from "react-day-picker";
import meetingsApi from "../../../api/meetingsApi";
import useAvailabilityCalendar from "../../../hooks/useAvailabilityCalendar";
import { Events, publish } from "../../../utils/events";
import CollapsibleTabPanel from "../../layout/CollapsibleTabPanel";
import OlympusBreadcrumbs from "../../layout/OlympusBreadcrumbs";
import MeetingsFilterPanel from "./availability/MeetingsFilterPanel";
import Day from "./DayDoughnut";
import MeetingStatisticsPanel from "./MeetingsStatisticsPanel";

export interface WeekViewProps {
  startDate: DateTime;
  breadcrumbs: Partial<BreadcrumbItemType>[];
}

const WeekView: React.FunctionComponent<WeekViewProps> = ({
  startDate,
  breadcrumbs,
}: WeekViewProps) => {
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

  const [dayPickerCurrent] = useState(startDate);

  let start = startDate.startOf("day");
  const endOfMonth = dayPickerCurrent.endOf("month");
  const startOfMonth = dayPickerCurrent.startOf("month");
  const summaryStart = startOfMonth.startOf("week").minus({ day: 1 });
  const summaryEnd = endOfMonth
    .plus({ day: 1 })
    .endOf("week")
    .minus({ day: 1 });
  const summaryDays = Math.ceil(
    Interval.fromDateTimes(summaryStart, summaryEnd).length("days"),
  );

  // An ISO week, Monday to Sunday, as the W-numbered URLs are.
  start = start.startOf("week");

  const end = start.plus({ days: 6 });

  console.group();
  console.log(`startOfMonth: ${startOfMonth.toISODate()}`);
  console.log(`endOfMonth: ${endOfMonth.toISODate()}`);
  console.log(`summaryStart: ${summaryStart.toISODate()}`);
  console.log(`summaryEnd: ${summaryEnd.toISODate()}`);
  console.log(`summaryDays: ${summaryDays}`);
  console.groupEnd();

  const [range, setRange] = useState<DateRange | undefined>({
    from: start.toJSDate(),
    to: end.toJSDate(),
  });
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [summary, setSummary] = useState<GetMeetingSummaryResponse | undefined>(
    undefined,
  );
  const [, setSummaryLoading] = useState(false);

  const renderDay = (day: Date) => {
    if (summary && summary.statusStatistics) {
      return (
        <Day
          day={day.getDate()}
          types={
            summary.statusStatistics[
              DateTime.fromJSDate(day).toFormat("yyyy-MM-dd")
            ]
          }
        />
      );
    } else {
      return <Day day={day.getDate()} types={{}} />;
    }
  };

  useEffect(() => {
    (async () => {
      if (range && range.from) {
        const rawEvents = await meetingsApi.getMeetings(
          DateTime.fromJSDate(range.from).startOf("day"),
          7,
        );
        setMeetings(rawEvents.data.items);
        await loadSummary();
      }
    })();
  }, [range]);

  const loadSummary = async (quiet: boolean = false) => {
    if (!quiet) {
      setSummaryLoading(true);
    }

    try {
      const endOfView = startDate.endOf("month").endOf("week");
      const summaryResponse = await meetingsApi.getSummary(endOfView, 42);
      setSummary(summaryResponse.data);
    } catch {
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "error",
        message: "Failed to load meetings",
        description: `Unable fetch meetings, please try again`,
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleDayClick = (date: Date) => {
    const target = DateTime.fromJSDate(date);
    const url = `/minerva/meetings/${target.year}/${target.toFormat("MM")}/${target.toFormat("dd")}`;

    router.push(url, url, { shallow: true });
  };

  const handleEventClick = (arg: EventClickArg) => {
    const target = DateTime.fromJSDate(arg.event.start!);
    const url = `/minerva/meetings/${target.year}/${target.toFormat("MM")}/${target.toFormat("dd")}?e=${encodeURIComponent(arg.event.id)}`;

    router.push(url, url, { shallow: true });
  };

  const weekStart = range?.from
    ? DateTime.fromJSDate(range.from).startOf("day")
    : undefined;
  const calendar = useAvailabilityCalendar({
    meetings,
    start: weekStart?.toJSDate(),
    end: weekStart?.plus({ days: 7 }).toJSDate(),
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
                mode={"range"}
                defaultMonth={startDate.startOf("month").toJSDate()}
                selected={range}
                weekStartsOn={1}
                ISOWeek={true}
                showWeekNumber={true}
                showOutsideDays={true}
                formatters={{
                  formatDay: renderDay,
                }}
                onDayClick={(date) => {
                  const start = DateTime.fromJSDate(date).startOf("week");

                  const end = start.plus({ days: 6 });

                  setRange({ from: start.toJSDate(), to: end.toJSDate() });

                  if (calendarRef && calendarRef.current) {
                    calendarRef.current.getApi().gotoDate(start.toJSDate());
                  }
                }}
                onMonthChange={() => {}}
                style={{
                  minWidth: 250,
                }}
              />
            </Space>
          </Space>
          <MeetingsFilterPanel />
          <Tabs
            defaultActiveKey={"week"}
            items={[
              {
                key: "week",
                label: "Week",
                children: (
                  <MeetingStatisticsPanel
                    startDate={startOfMonth}
                    dayCount={7}
                  />
                ),
              },
              {
                key: "month",
                label: "Month",
                children: (
                  <MeetingStatisticsPanel
                    startDate={startOfMonth}
                    dayCount={30}
                  />
                ),
              },
            ]}
          />
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
        <div
          ref={rootRef}
          style={{ height: "calc(100vh - 102px)", paddingLeft: 16 }}
        >
          <FullCalendar
            ref={calendarRef}
            viewClassNames={"minerva-cal minerva-cal-week"}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            initialDate={range?.from}
            firstDay={1}
            headerToolbar={{
              start: "title",
              center: "",
              end: "",
            }}
            height={"100%"}
            events={calendar.events}
            eventContent={calendar.eventContent}
            selectable={true}
            selectMirror={true}
            select={calendar.select}
            selectAllow={calendar.selectAllow}
            eventChange={calendar.eventChange}
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5],
              startTime: "9:00",
              endTime: "17:00",
            }}
            slotDuration={{ minutes: 15 }}
            nowIndicator={true}
            navLinks={true}
            navLinkDayClick={handleDayClick}
            navLinkWeekClick={handleDayClick}
            eventClick={calendar.eventClick}
          />
        </div>
      </CollapsibleTabPanel>
    </>
  );
};
export default WeekView;
