import {
  CalendarOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import type { EventInput } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import {
  Avatar,
  Breadcrumb,
  Col,
  Collapse,
  Empty,
  Layout,
  Row,
  Space,
  Spin,
  Switch,
  Tabs,
  Typography,
} from "antd";
import type { BreadcrumbItemType } from "antd/lib/breadcrumb/Breadcrumb";
import { DateTime, Interval } from "luxon";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import meetingsApi from "../../../api/meetingsApi";
import notesApi from "../../../api/notestApi";
import { publish } from "../../../utils/events";
import type { Note } from "../../../utils/notes";
import { PUBLISH_EVENT } from "../../common/NotificationSink";
import Day from "./DayDoughnut";
import NotesEditorForm, {
  type NotesFormInput,
} from "../../notes/NotesEditorForm";
import TimelineEntry from "../../notes/TimelineEntry";
import AttendeeAvatar from "./AttendeeAvatar";
import MeetingStatisticsPanel from "./MeetingsStatisticsPanel";

const { Sider, Content } = Layout;

export interface DayViewProps {
  startDate: DateTime;
  breadcrumbs: Partial<BreadcrumbItemType>[];
}

const DayView: React.FunctionComponent<DayViewProps> = ({
  startDate,
  breadcrumbs,
}: DayViewProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathName = usePathname();

  const calendarRef = useRef<FullCalendar>(null);

  const [dayPickerCurrent, setDayPickerCurrent] = useState(startDate);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(false);
  const [targetEventId, setTargetEventId] = useState<string | undefined>(
    undefined,
  );
  const [event, setEvent] = useState<any>(undefined);
  const [nextEventInSeries, setNextEventInSeries] = useState<any>(undefined);
  const [eventNotes, setEventNotes] = useState([]);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState(false);
  const [summary, setSummary] = useState<any>(undefined);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const [notedEditorOpen, setNotedEditorOpen] = useState(false);
  const [showMeta, setShowMeta] = useState(true);

  const { handleSubmit, control, reset } = useForm<NotesFormInput>({
    defaultValues: {
      author: "ncfritz",
      type: 1,
      flagged: false,
      value: "",
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const start = startDate.startOf("day");
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

  console.groupCollapsed();
  console.log(`startOfMonth: ${startOfMonth.toISODate()}`);
  console.log(`endOfMonth: ${endOfMonth.toISODate()}`);
  console.log(`summaryStart: ${summaryStart.toISODate()}`);
  console.log(`summaryEnd: ${summaryEnd.toISODate()}`);
  console.log(`summaryDays: ${summaryDays}`);
  console.groupEnd();

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
    if (searchParams) {
      const eventId = searchParams.get("e");

      if (eventId) {
        setTargetEventId(eventId);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      setEventError(false);

      try {
        setEventsLoading(true);
        const getMeetingsResponse = await meetingsApi.getMeetings(start, 1);
        const parsedEvents: EventInput[] = [];

        getMeetingsResponse.data.items.forEach((rawEvent: any) => {
          parsedEvents.push(meetingsApi.toEvent(rawEvent));
        });

        setEvents(parsedEvents);
        await loadSummary();
      } catch (e) {
        publish(PUBLISH_EVENT, {
          type: "error",
          message: "Failed to load meetings",
          description: `Unable fetch meetings, please try again`,
        });
        setEventsError(true);
      } finally {
        setEventsLoading(false);
      }
    })();
  }, [startDate]);

  useEffect(() => {
    (async () => {
      setEventLoading(true);

      try {
        setEventError(false);

        if (targetEventId) {
          const response = await meetingsApi.getMeeting(targetEventId);
          setEvent(response.data.item);
          const notesResponse = await notesApi.getNotesForEntity(
            "meeting",
            targetEventId,
          );
          setEventNotes(notesResponse.data.notes);
          const nextEventResponse =
            await meetingsApi.getNextMeetingInSeries(targetEventId);
          setNextEventInSeries(nextEventResponse.data.item);

          const newEvents = [];

          for (const e of events) {
            const classIndex = e.classNames?.indexOf("selected") || -1;

            if (e.id !== targetEventId && classIndex > -1) {
              (e.classNames! as string[]).splice(classIndex, 1);
            } else if (e.id === targetEventId && classIndex < 0) {
              ((e.classNames as string[]) || []).push("selected");
            }

            newEvents.push(e);
          }

          setEvents(newEvents);
        }
      } catch (e) {
        publish(PUBLISH_EVENT, {
          type: "error",
          message: "Failed to load meeting",
          description: `Unable fetch meeting details, please try again`,
        });
        setEventError(true);
      } finally {
        setEventLoading(false);
      }
    })();
  }, [targetEventId]);

  useEffect(() => {
    (async () => {
      await loadSummary(true);
    })();
  }, [dayPickerCurrent]);

  const toggleNotesEditor = () => {
    setNotedEditorOpen(!notedEditorOpen);
  };

  const loadSummary = async (quiet: boolean = false) => {
    if (!quiet) {
      setSummaryLoading(true);
    }

    try {
      setSummaryError(false);
      const summaryResponse = await meetingsApi.getSummary(
        summaryStart,
        summaryDays,
      );
      setSummary(summaryResponse.data);
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to load meeting summary",
        description: `Unable fetch meeting summary for range ${startOfMonth.toISODate()} to ${endOfMonth.toISODate()}`,
      });
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
    }
  };

  const updateNotes = async () => {
    try {
      const notesResponse = await notesApi.getNotesForEntity(
        "meeting",
        targetEventId!,
      );
      setEventNotes(notesResponse.data.notes);
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to load notes",
        description: `Unable fetch notes for the selected meeting`,
      });
    }
  };

  const afterNoteUpdate = async (updated: Note, isPermanent?: boolean) => {
    await updateNotes();
  };

  const notesContent = [];

  if (eventNotes) {
    if (eventNotes.length <= 0) {
      notesContent.push(
        <Empty
          key={uuidv4()}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={"No notes to display for this meeting."}
        />,
      );
    } else {
      eventNotes.forEach((item) => {
        notesContent.push(
          <TimelineEntry
            key={uuidv4()}
            item={item}
            showMetadata={showMeta}
            showAssociations={false}
            deleteCallback={afterNoteUpdate}
            restoreCallback={afterNoteUpdate}
            updateCallback={afterNoteUpdate}
            updateFlagCallback={afterNoteUpdate}
            showEditorTitle={false}
            showEditorSummary={false}
            leftMargin={0}
          />,
        );
      });
    }
  }

  let eventContent;

  if (eventLoading) {
    eventContent = <Spin size={"large"} />;
  } else if (event) {
    eventContent = (
      <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
        <Space
          direction={"vertical"}
          className={`oa-event oa-status-${event.status.toLowerCase()} minerva-event`}
          style={{
            width: "calc(100% - 16px)",
            margin: 8,
            position: "relative",
            borderRadius: 6,
          }}
        >
          <Typography.Title level={4}>{event.subject}</Typography.Title>
          <Typography.Text>Organizer:</Typography.Text>
          <Space
            size={8}
            direction={"horizontal"}
            style={{ alignItems: "center" }}
          >
            <Space direction={"horizontal"}>
              <Avatar
                shape={"circle"}
                size={"large"}
                src={`https://cdn.ncfritz.net/amzn/avatar/${event.organizer.alias}.jpg`}
              />
              <Space direction={"vertical"} size={0}>
                <Typography.Title
                  level={5}
                  style={{ paddingBottom: 2, margin: 0 }}
                >
                  {`${event.organizer.givenName} ${event.organizer.surname}`}
                </Typography.Title>
                <Typography.Text strong={true}>
                  {event.organizer.email}
                </Typography.Text>
              </Space>
            </Space>
          </Space>
          <Typography.Text strong={true}>Attendees:</Typography.Text>
          <Space
            size={8}
            direction={"horizontal"}
            style={{ alignItems: "center" }}
          >
            <Avatar.Group
              maxCount={15}
              maxPopoverTrigger={"click"}
              size={"large"}
            >
              {event.attendees.map((attendee: any) => {
                return <AttendeeAvatar attendee={attendee} key={uuidv4()} />;
              })}
            </Avatar.Group>
          </Space>
        </Space>
        <Space
          direction={"vertical"}
          style={{
            width: "100%",
            height: "calc(100vh - 356px)",
            overflowY: "scroll",
          }}
        >
          <Collapse
            style={{ padding: 8 }}
            activeKey={notedEditorOpen ? "dayView-notesEditor" : undefined}
            expandIcon={(panelProps) => {
              return panelProps.isActive ? (
                <CaretDownOutlined />
              ) : (
                <CaretRightOutlined />
              );
            }}
            onChange={() => {
              toggleNotesEditor();
            }}
            ghost={true}
            items={[
              {
                key: "dayView-notesEditor",
                label: <Typography.Title level={5}>Add Note</Typography.Title>,
                children: (
                  <NotesEditorForm
                    onClose={() => {
                      toggleNotesEditor();
                    }}
                    beforeCreate={(candidate) => {
                      return {
                        ...candidate,
                        associations: [
                          {
                            itemId: event.id,
                            itemType: "meeting",
                          },
                        ],
                      };
                    }}
                    formControl={{
                      control: control,
                      reset: reset,
                      handleSubmit: handleSubmit,
                    }}
                    afterCreate={updateNotes}
                    mainEditorHeight={300}
                    showTitle={false}
                    showSummary={false}
                  />
                ),
              },
            ]}
          />
          <Space
            style={{
              paddingLeft: 8,
              width: "100%",
            }}
          >
            <Typography.Title level={5} style={{ marginBottom: 0 }}>
              Notes
            </Typography.Title>
          </Space>
          {notesContent}
        </Space>
      </Space>
    );
  } else {
    eventContent = (
      <Empty description={"No event selected"} style={{ marginTop: 64 }} />
    );
  }

  let nextEventContent = undefined;

  if (nextEventInSeries) {
    const nextEventStart = DateTime.fromISO(nextEventInSeries.startTime);
    const nextEventEnd = DateTime.fromISO(nextEventInSeries.endTime);

    nextEventContent = (
      <Space
        direction={"vertical"}
        className={`oa-event oa-status-${nextEventInSeries.status.toLowerCase()} minerva-event no-gutter`}
        style={{
          width: "100%",
          position: "relative",
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        <Typography.Title level={5}>Next in Series:</Typography.Title>
        <Space direction={"horizontal"} size={8}>
          <CalendarOutlined />
          <Typography.Text style={{ fontSize: "12px" }}>
            {nextEventStart.toFormat("DDDD")}
          </Typography.Text>
        </Space>
        <Space direction={"horizontal"} size={8}>
          <ClockCircleOutlined />
          <Typography.Text style={{ fontSize: "12px" }}>
            {nextEventStart.toFormat("t")} - {nextEventEnd.toFormat("t")}
          </Typography.Text>
        </Space>
      </Space>
    );
  }

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
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 102px)",
          width: "100%",
        }}
      >
        <Content
          style={{
            width: "calc(100vw - 780x)",
          }}
        >
          <Row style={{ width: "calc(100% - 780px)" }}>
            <Col span={7} style={{ height: "calc(100vh - 102px)" }}>
              <FullCalendar
                ref={calendarRef}
                plugins={[timeGridPlugin, listPlugin]}
                viewClassNames={"minerva-cal hide-day-header"}
                eventClassNames={(arg) => {
                  if (targetEventId && arg.event.id === targetEventId) {
                    return "selected";
                  }

                  return "";
                }}
                initialDate={startDate.toJSDate()}
                events={events}
                initialView="timeGridDay"
                height={"100%"}
                businessHours={{
                  days: [1, 2, 3, 4, 5],
                  startTime: "9:00",
                  endTime: "17:00",
                }}
                headerToolbar={{
                  start: "title",
                  center: "",
                  end: "",
                }}
                titleFormat={{
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                }}
                nowIndicator={true}
                slotDuration={{ minutes: 15 }}
                eventClick={(arg) => {
                  setTargetEventId(arg.event.id);
                  /*router.push(
                    `${pathName}?e=${arg.event.id}`,
                    `${pathName}?e=${arg.event.id}`,
                    { shallow: true },
                  );*/
                }}
              />
            </Col>
            <Col
              span={17}
              style={{
                height: "calc(100vh - 102px)",
                borderLeft: "1px solid #e6e6e6",
              }}
            >
              {eventContent}
            </Col>
          </Row>
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
            month={dayPickerCurrent.toJSDate()}
            showWeekNumber={true}
            showOutsideDays={true}
            formatters={{
              formatDay: renderDay,
            }}
            onDayClick={(date) => {
              if (calendarRef && calendarRef.current) {
                calendarRef.current.getApi().gotoDate(date);
              }
            }}
            onMonthChange={(date) => {
              setDayPickerCurrent(DateTime.fromJSDate(date));
            }}
            style={{
              minWidth: 250,
            }}
          />
          {nextEventContent}
          <Tabs
            defaultActiveKey={"today"}
            items={[
              {
                key: "today",
                label: "Today",
                children: <>dddslak</>,
              },
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
              {
                key: "config",
                label: "Configuration",
                children: (
                  <Space
                    size={8}
                    direction={"vertical"}
                    style={{ width: "100%" }}
                  >
                    <Space
                      direction={"horizontal"}
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                        paddingRight: 8,
                      }}
                    >
                      <Typography.Text>Show note metadata</Typography.Text>
                      <Switch
                        checked={showMeta}
                        onChange={(checked) => {
                          setShowMeta(checked);
                        }}
                      />
                    </Space>
                  </Space>
                ),
              },
            ]}
          />
        </Sider>
      </Layout>
    </Space>
  );
};
export default DayView;
