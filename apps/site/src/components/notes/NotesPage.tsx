import { HomeOutlined, RadarChartOutlined } from "@ant-design/icons";
import type { GetSummaryResponse, Note } from "@ncfritz/olympus-sdk/minerva";
import { Empty, Layout, Space, Spin, Switch, Typography } from "antd";
import type { BreadcrumbItemType } from "antd/lib/breadcrumb/Breadcrumb";
import { DateTime, Interval } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";
import notesApi from "../../api/notestApi";
import OlympusBreadcrumbs from "../layout/OlympusBreadcrumbs";
import Day from "./DayDoughnut";
import MonthGraph from "./MonthGraph";
import NotesHourOfDayGraph from "./NotesHourOfDayGraph";
import NotesTypeGraph from "./NotesTypeGraph";
import NoteTypeFilterButton from "./NoteTypeFilterButton";
import NotesTimelineBlock from "./TimelineBlock";
import { subscribe, unsubscribe } from "../../utils/events";
import { v4 as uuidv4 } from "uuid";

const { Sider, Content } = Layout;

export interface NotesPageProps {
  startDate: DateTime;
  days: number;
  breadcrumbs: BreadcrumbItemType[];
}

const IndexPage: React.FunctionComponent<NotesPageProps> = ({
  startDate,
  days,
  breadcrumbs,
}: NotesPageProps) => {
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(startDate);
  const [currentDayCount, setCurrentDayCount] = useState(days);
  const [typeFilters, setTypeFilters] = useState<Record<string, boolean>>({});
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState<GetSummaryResponse | undefined>(
    undefined,
  );
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showMeta, setShowMeta] = useState(true);
  const [showDeleted, setShowDeleted] = useState(true);
  const [showEmptyDays, setShowEmptyDays] = useState(false);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [hideAssociated, setHideAssociated] = useState(true);

  const today = DateTime.now();

  const onNotesChanged = async () => {
    await loadMonthlySummary(currentDate, currentDayCount, true);
  };

  const loadMonthlySummary = async (
    start: DateTime,
    count: number,
    quiet: boolean = false,
  ) => {
    if (!quiet) {
      setSummaryLoading(true);
    }

    try {
      const monthlySummaryResponse = await notesApi.getSummary(start, count);
      setSummary(monthlySummaryResponse.data);
    } catch (e) {
      console.log(e);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    subscribe("notes:noteAdded", onNotesChanged);

    return () => {
      unsubscribe("notes:noteAdded", onNotesChanged);
    };
  }, []);

  useEffect(() => {
    (async () => {
      await loadMonthlySummary(startDate, days);
    })();
  }, []);

  const renderDay = (day: Date) => {
    if (summary && summary.counts) {
      return (
        <Day
          day={day.getDate()}
          types={
            summary.counts[DateTime.fromJSDate(day).toFormat("yyyy-MM-dd")]
          }
        />
      );
    } else {
      return <Day day={day.getDate()} types={{}} />;
    }
  };

  const handleMonthChange = async (month: Date) => {
    const target = DateTime.fromJSDate(month);
    let targetStart;
    let targetCount = 30;

    if (target.month === today.month && target.year === today.year) {
      await router.push("/minerva/notes", "/minerva/notes", { shallow: true });
      targetStart = today;
    } else {
      const path =
        "/minerva/notes/" + DateTime.fromJSDate(month).toFormat("yyyy/MM");
      await router.push(path, path, { shallow: true });
      targetStart = target.startOf("month");

      const targetEnd = targetStart.endOf("month");
      const interval = Interval.fromDateTimes(targetStart, targetEnd);
      targetCount = Math.ceil(interval.length("days"));
    }

    setCurrentDate(targetStart);
    setCurrentDayCount(targetCount);
    await loadMonthlySummary(targetStart, targetCount, true);
  };

  const handleToggleDayVisibility = (date: Date) => {
    const target = DateTime.fromJSDate(date);
    const key = target.toFormat("yyyy-MM-dd");
    const currentValue = openDates[key];
    const newOpenDays = Object.assign({}, openDates);
    newOpenDays[key] = !currentValue;

    setOpenDates(newOpenDays);
  };

  const handleToggleTypeFilter = (type: string) => {
    const newTypeFilters = Object.assign({}, typeFilters);
    newTypeFilters[type] = type in typeFilters ? !typeFilters[type] : true;

    setTypeFilters(newTypeFilters);
  };

  const handleNoteUpdate = async (updated: Note, isPermanent: boolean) => {
    if (isPermanent) {
      await loadMonthlySummary(today, 30, true);
    }
  };

  let datePickerContent;

  if (summaryLoading) {
    datePickerContent = <Spin size={"default"} />;
  } else {
    datePickerContent = (
      <DayPicker
        month={startDate.toJSDate()}
        toMonth={today.toJSDate()}
        showWeekNumber={true}
        showOutsideDays={true}
        formatters={{
          formatDay: renderDay,
        }}
        onDayClick={handleToggleDayVisibility}
        onMonthChange={handleMonthChange}
        style={{
          minWidth: 250,
        }}
      />
    );
  }

  let timelineContent = undefined;

  if (summaryLoading) {
    timelineContent = <Spin size={"default"} />;
  } else {
    const entriesContent = [];

    if (summary && summary.counts && Object.keys(summary.counts).length > 0) {
      for (const key in summary.counts) {
        const daySummary = summary.counts[key];

        if (daySummary.total > 0 || showEmptyDays) {
          entriesContent.push(
            <NotesTimelineBlock
              key={`block-${key}`}
              date={key}
              open={openDates[key]}
              showDeleted={showDeleted}
              showMetadata={showMeta}
              hideAssociated={hideAssociated}
              showFlaggedOnly={showFlaggedOnly}
              typeFilters={typeFilters}
              renderEmptyDays={showEmptyDays}
              summaryLoading={summaryLoading}
              summary={daySummary}
              afterUpdate={handleNoteUpdate}
              handleToggleDay={handleToggleDayVisibility}
              toggleFilter={handleToggleTypeFilter}
            />,
          );
        }
      }
    }

    if (entriesContent.length <= 0) {
      entriesContent.push(<Empty key={uuidv4()} />);
    }

    timelineContent = (
      <Space direction={"vertical"} size={0} style={{ width: "100%" }}>
        {entriesContent}
      </Space>
    );
  }

  return (
    <Space direction={"vertical"} size={0}>
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
      <Content
        style={{
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 102,
          marginRight: 788,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 102px)",
        }}
      >
        <Content style={{ width: "calc(100vw - 780px)" }}>
          <MonthGraph
            date={startDate}
            days={days}
            summaryLoading={summaryLoading}
            summary={summary}
          />
          <Space
            direction={"vertical"}
            size={0}
            style={{
              width: "100%",
              overflowY: "scroll",
              height: "calc(100vh - 302px)",
              scrollbarWidth: "none",
              paddingRight: 8,
            }}
          >
            {timelineContent}
          </Space>
        </Content>
        <Sider
          width={400}
          collapsible={false}
          style={{
            background: "#ffffff",
            top: 92,
            right: 0,
            position: "fixed",
            height: "calc(100vh - 104px)",
            borderLeft: "1px solid #f0f0f0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Space
            size={8}
            className={"date-picker"}
            direction={"vertical"}
            style={{ width: 390 }}
          >
            <Space
              style={{
                borderBottom: "1px solid #f6f6f6",
                width: "100%",
                justifyContent: "center",
              }}
            >
              {datePickerContent}
            </Space>
            <Space
              size={16}
              direction={"vertical"}
              style={{
                padding: 16,
                width: "100%",
                borderBottom: "1px solid #f6f6f6",
              }}
            >
              <Typography.Title level={5}>Filters</Typography.Title>
              <Space size={16} direction={"vertical"} style={{ width: "100%" }}>
                <Space
                  size={8}
                  direction={"vertical"}
                  style={{ width: "100%" }}
                >
                  <Typography.Text>Type</Typography.Text>
                  <Space.Compact block={true} style={{ width: "100%" }}>
                    {[0, 1, 2, 3, 4, 5].map((i) => {
                      return (
                        <NoteTypeFilterButton
                          key={`filter-${i}`}
                          noteType={i}
                          onToggle={handleToggleTypeFilter}
                          typeFilters={typeFilters}
                        />
                      );
                    })}
                  </Space.Compact>
                </Space>
                <Space
                  direction={"horizontal"}
                  style={{
                    width: "100%",
                    justifyContent: "space-between",
                    paddingRight: 8,
                  }}
                >
                  <Typography.Text>Show metadata</Typography.Text>
                  <Switch
                    checked={showMeta}
                    onChange={(checked) => {
                      setShowMeta(checked);
                    }}
                  />
                </Space>
                <Space
                  direction={"horizontal"}
                  style={{
                    width: "100%",
                    justifyContent: "space-between",
                    paddingRight: 8,
                  }}
                >
                  <Typography.Text>
                    Hide notes with associations
                  </Typography.Text>
                  <Switch
                    checked={hideAssociated}
                    onChange={(checked) => {
                      setHideAssociated(checked);
                    }}
                  />
                </Space>
                <Space
                  direction={"horizontal"}
                  style={{
                    width: "100%",
                    justifyContent: "space-between",
                    paddingRight: 8,
                  }}
                >
                  <Typography.Text>Show deleted notes</Typography.Text>
                  <Switch
                    checked={showDeleted}
                    onChange={(checked) => {
                      setShowDeleted(checked);
                    }}
                  />
                </Space>
                <Space
                  direction={"horizontal"}
                  style={{
                    width: "100%",
                    justifyContent: "space-between",
                    paddingRight: 8,
                  }}
                >
                  <Typography.Text>Only show flagged notes</Typography.Text>
                  <Switch
                    checked={showFlaggedOnly}
                    onChange={(checked) => {
                      setShowFlaggedOnly(checked);
                    }}
                  />
                </Space>
                <Space
                  direction={"horizontal"}
                  style={{
                    width: "100%",
                    justifyContent: "space-between",
                    paddingRight: 8,
                  }}
                >
                  <Typography.Text>Show empty days</Typography.Text>
                  <Switch
                    checked={showEmptyDays}
                    onChange={(checked) => {
                      setShowEmptyDays(checked);
                    }}
                  />
                </Space>
              </Space>
            </Space>
            <Space
              style={{
                padding: "0px 16px 16px 16px",
                borderBottom: "1px solid #f6f6f6",
              }}
            >
              <NotesTypeGraph
                date={startDate}
                days={days}
                summaryLoading={summaryLoading}
                summary={summary}
              />
            </Space>
            <Space
              style={{
                padding: "0px 16px 16px 16px",
                borderBottom: "1px solid #f6f6f6",
              }}
            >
              <NotesHourOfDayGraph
                date={startDate}
                summaryLoading={summaryLoading}
                summary={summary}
              />
            </Space>
          </Space>
        </Sider>
      </Content>
    </Space>
  );
};

export default IndexPage;
