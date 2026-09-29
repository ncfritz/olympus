import { HomeOutlined, RadarChartOutlined } from "@ant-design/icons";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Layout, Space, Tabs } from "antd";
import type { BreadcrumbItemType } from "antd/lib/breadcrumb/Breadcrumb";
import { DateTime, Interval } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import { type DateRange, DayPicker } from "react-day-picker";
import meetingsApi from "../../../api/meetingsApi";
import { Events, publish } from "../../../utils/events";
import OlympusBreadcrumbs from "../../layout/OlympusBreadcrumbs";
import Day from "./DayDoughnut";
import MeetingStatisticsPanel from "./MeetingsStatisticsPanel";

const { Sider, Content } = Layout;

export interface WeekViewProps {
  startDate: DateTime;
  breadcrumbs: Partial<BreadcrumbItemType>[];
}

const WeekView: React.FunctionComponent<WeekViewProps> = ({
  startDate,
  breadcrumbs,
}: WeekViewProps) => {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);

  const [dayPickerCurrent, setDayPickerCurrent] = useState(startDate);

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

  if (start.weekday !== 7) {
    start = start.startOf("week").set({ weekday: 7 }).minus({ weeks: 1 });
  }

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
  const [events, setEvents] = useState<EventInput[]>([]);
  const [summary, setSummary] = useState<any>(undefined);
  const [summaryLoading, setSummaryLoading] = useState(false);

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
        const parsedEvents: EventInput[] = [];

        rawEvents.data.items.forEach((rawEvent: any) => {
          parsedEvents.push(meetingsApi.toEvent(rawEvent));
        });

        setEvents(parsedEvents);
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

  return (
    <Space>
      <OlympusBreadcrumbs
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
      <Layout
        style={{
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 102,
          left: 380,
          marginRight: 788,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 102px)",
        }}
      >
        <Content style={{ width: "calc(100vw - 780px)" }}>
          <FullCalendar
            ref={calendarRef}
            viewClassNames={"minerva-cal minerva-cal-week"}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            initialDate={range?.from}
            headerToolbar={{
              start: "title",
              center: "",
              end: "",
            }}
            height={"100%"}
            events={events}
            businessHours={{
              days: [1, 2, 3, 4, 5],
              startTime: "9:00",
              endTime: "17:00",
            }}
            slotDuration={{ minutes: 15 }}
            nowIndicator={true}
            navLinks={true}
            navLinkDayClick={handleDayClick}
            navLinkWeekClick={handleDayClick}
            eventClick={handleEventClick}
          />
        </Content>
        <Sider
          width={400}
          collapsible={false}
          style={{
            background: "#ffffff",
            top: 102,
            right: 0,
            position: "fixed",
            height: "calc(100vh - 104px)",
            borderLeft: "1px solid #f0f0f0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <DayPicker
            className={"minerva-standard"}
            mode={"range"}
            defaultMonth={startDate.startOf("month").toJSDate()}
            selected={range}
            showWeekNumber={true}
            showOutsideDays={true}
            formatters={{
              formatDay: renderDay,
            }}
            onDayClick={(date) => {
              let start = DateTime.fromJSDate(date);

              if (start.weekday !== 7) {
                start = start
                  .startOf("week")
                  .set({ weekday: 7 })
                  .minus({ weeks: 1 });
              }

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
        </Sider>
      </Layout>
    </Space>
  );
};
export default WeekView;
