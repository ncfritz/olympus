import type { GetMeetingSummaryResponse } from "@ncfritz/olympus-sdk/minerva";
import {
  CaretDownOutlined,
  CaretRightOutlined,
  HomeOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import type { EventInput } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import {
  Avatar,
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
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import meetingsApi from "../../../api/meetingsApi";
import notesApi from "../../../api/notestApi";
import { Events, publish } from "../../../utils/events";
import OlympusBreadcrumbs from "../../layout/OlympusBreadcrumbs";
import Day from "./DayDoughnut";
import NotesEditorForm, {
  type NotesFormInput,
} from "../../notes/NotesEditorForm";
import TimelineEntry from "../../notes/TimelineEntry";
import AttendeeAvatar from "./AttendeeAvatar";
import DayStatisticsPanel from "./DayStatisticsPanel";
import EventChip from "./EventChip";
import MeetingStatisticsPanel from "./MeetingsStatisticsPanel";
import PreviousMeeting from "./PreviousMeeting";
import { type Note } from "@ncfritz/olympus-sdk/minerva";

const { Sider, Content } = Layout;

export interface DayViewProps {
  startDate: DateTime;
  breadcrumbs: Partial<BreadcrumbItemType>[];
}

/**
 * A meeting as the API returns it. Taken from the call because the SDK exports
 * no name for it, and restating the shape here would be a second copy to keep.
 */
type RawMeeting = Awaited<
  ReturnType<typeof meetingsApi.getMeetings>
>["data"]["items"][number];

const DayView: React.FunctionComponent<DayViewProps> = ({
  startDate,
  breadcrumbs,
}: DayViewProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const calendarRef = useRef<FullCalendar>(null);

  const [selectedDate, setSelectedDate] = useState(startDate);
  const [dayPickerCurrent, setDayPickerCurrent] = useState(startDate);
  const [rawEvents, setRawEvents] = useState<RawMeeting[]>([]);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [, setEventsLoading] = useState(false);
  const [, setEventsError] = useState(false);
  const [targetEventId, setTargetEventId] = useState<string | undefined>(
    undefined,
  );
  const [event, setEvent] = useState<RawMeeting | undefined | undefined>(
    undefined,
  );
  const [nextEventInSeries, setNextEventInSeries] = useState<
    RawMeeting | undefined | undefined
  >(undefined);
  const [previousEventsInSeries, setPreviousEventsInSeries] = useState<
    RawMeeting[]
  >([]);
  const [eventNotes, setEventNotes] = useState<Note[]>([]);
  const [eventLoading, setEventLoading] = useState(false);
  const [, setEventError] = useState(false);
  const [summary, setSummary] = useState<GetMeetingSummaryResponse | undefined>(
    undefined,
  );
  const [, setSummaryLoading] = useState(false);
  const [, setSummaryError] = useState(false);
  const [notedEditorOpen, setNotedEditorOpen] = useState(false);
  const [showMeta, setShowMeta] = useState(true);

  const { handleSubmit, control, reset } = useForm<NotesFormInput>({
    defaultValues: {
      type: 1,
      flagged: false,
      value: "",
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

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

  console.groupCollapsed("Date calculations");
  console.log(`props.startDate: ${startDate.toISODate()}`);
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
        const start = selectedDate.startOf("day");

        setEventsLoading(true);
        const getMeetingsResponse = await meetingsApi.getMeetings(start, 1);
        const parsedEvents: EventInput[] = [];

        getMeetingsResponse.data.items.forEach((rawEvent) => {
          parsedEvents.push(meetingsApi.toEvent(rawEvent));
        });

        setEvents(parsedEvents);
        setRawEvents(getMeetingsResponse.data.items);
        await loadSummary();
      } catch {
        publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
          type: "error",
          message: "Failed to load meetings",
          description: `Unable fetch meetings, please try again`,
        });
        setEventsError(true);
      } finally {
        setEventsLoading(false);
      }
    })();
  }, [selectedDate]);

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

          const previousEventsResponse =
            await meetingsApi.getPreviousMeetingInSeries(targetEventId);
          setPreviousEventsInSeries(previousEventsResponse.data.items);

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
      } catch {
        publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
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
    } catch {
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
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
    } catch {
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "error",
        message: "Failed to load notes",
        description: `Unable fetch notes for the selected meeting`,
      });
    }
  };

  const afterNoteUpdate = async (_updated: Note) => {
    await updateNotes();
  };

  let previousOccurrencesContent = undefined;

  if (previousEventsInSeries?.length > 0) {
    previousOccurrencesContent = (
      <Space
        direction={"vertical"}
        size={8}
        style={{
          marginLeft: 8,
          width: "100%",
        }}
        styles={{ item: { width: "100%" } }}
      >
        <Typography.Title level={5} style={{ marginBottom: 0 }}>
          Previous Occurrences
        </Typography.Title>
        <Space
          direction={"vertical"}
          style={{
            width: "100%",
          }}
          size={0}
        >
          {previousEventsInSeries.map((previousEvent) => {
            return (
              <PreviousMeeting event={previousEvent} showMeta={showMeta} />
            );
          })}
        </Space>
      </Space>
    );
  }

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
    eventContent = (
      <Space
        direction={"vertical"}
        style={{ width: "100%", textAlign: "center", marginTop: 64 }}
      >
        <Spin size={"large"} tip={"Loading..."}>
          <div />
        </Spin>
      </Space>
    );
  } else if (event) {
    eventContent = (
      <Space orientation={"vertical"} size={8} style={{ width: "100%" }}>
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
            <Space orientation={"horizontal"}>
              <Avatar
                shape={"circle"}
                size={"large"}
                src={`https://cdn.internal.ncfritz.net/amzn/avatar/${event.organizer.alias}.jpg`}
              />
              <Space orientation={"vertical"} size={0}>
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
              {event.attendees.map((attendee) => {
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
          {previousOccurrencesContent}
        </Space>
      </Space>
    );
  } else {
    eventContent = (
      <Empty description={"No event selected"} style={{ marginTop: 64 }} />
    );
  }

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
                initialDate={selectedDate.toJSDate()}
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
          className={"sider-full"}
        >
          <DayPicker
            className={"minerva-standard"}
            month={dayPickerCurrent.toJSDate()}
            showWeekNumber={true}
            showOutsideDays={true}
            selected={selectedDate.toJSDate()}
            formatters={{
              formatDay: renderDay,
            }}
            onDayClick={(date) => {
              const target = DateTime.fromJSDate(date);

              router.push(
                `/minerva/meetings/${target.toFormat("yyyy/MM/dd")}`,
                `/minerva/meetings/${target.toFormat("yyyy/MM/dd")}`,
                { shallow: true },
              );
              setSelectedDate(target);

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
          {nextEventInSeries && (
            <Space
              orientation={"vertical"}
              style={{ padding: 8, width: "100%" }}
            >
              <EventChip event={nextEventInSeries} />
            </Space>
          )}
          <Tabs
            defaultActiveKey={"today"}
            items={[
              {
                key: "today",
                label: "Today",
                children: (
                  <DayStatisticsPanel
                    events={rawEvents}
                    onEventClick={async (event) => {
                      setTargetEventId(event.id);
                    }}
                  />
                ),
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
                        padding: 8,
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
