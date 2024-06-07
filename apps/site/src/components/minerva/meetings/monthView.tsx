import { HomeOutlined, RadarChartOutlined } from "@ant-design/icons";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Breadcrumb, Layout, Space } from "antd";
import type { BreadcrumbItemType } from "antd/lib/breadcrumb/Breadcrumb";
import { DateTime, Interval } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import meetingsApi from "../../../api/meetingsApi";

const { Sider, Content } = Layout;

export interface MonthViewProps {
  startDate: DateTime;
  breadcrumbs: Partial<BreadcrumbItemType>[];
}

const MonthView: React.FunctionComponent<MonthViewProps> = ({
  startDate,
  breadcrumbs,
}: MonthViewProps) => {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);

  const [events, setEvents] = useState<EventInput[]>([]);

  const start = startDate.startOf("week");
  const end = startDate.endOf("month").endOf("week");
  const interval = Interval.fromDateTimes(start, end);
  const days = interval.length("days");

  useEffect(() => {
    (async () => {
      const rawEvents = await meetingsApi.getMeetings(start, days);
      const parsedEvents: EventInput[] = [];

      rawEvents.data.items.forEach((rawEvent: any) => {
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

  return (
    <Space>
      <Breadcrumb
        style={{
          padding: 8,
          background: "#f6f6f6",
          position: "fixed",
          top: 64,
          width: "100%",
          zIndex: 1000,
        }}
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
          overflow: "visible",
          height: "calc(100vh - 102px)",
          zIndex: 400,
        }}
      >
        <Content style={{ width: "calc(100vw - 780px)" }}>
          <FullCalendar
            ref={calendarRef}
            viewClassNames={"minerva-cal minerva-cal-month"}
            plugins={[dayGridPlugin, interactionPlugin]}
            events={events}
            initialView="dayGridMonth"
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
              days: [1, 2, 3, 4, 5],
              startTime: "9:00",
              endTime: "17:00",
            }}
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
        </Sider>
      </Layout>
    </Space>
  );
};
export default MonthView;
