import { HomeOutlined, RadarChartOutlined } from "@ant-design/icons";
import type { EventInput } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";

import {
  Avatar,
  Breadcrumb,
  Col,
  Empty,
  Layout,
  Row,
  Space,
  Spin,
  Tabs,
  Typography,
} from "antd";
import type { BreadcrumbItemType } from "antd/lib/breadcrumb/Breadcrumb";
import { DateTime } from "luxon";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import meetingsApi from "../../../api/meetingsApi";
import notesApi from "../../../api/notestApi";
import type { Note } from "../../../utils/notes";
import Day from "./DayDoughnut";
import NotesEditorForm, {
  type NotesFormInput,
} from "../../notes/NotesEditorForm";
import TimelineEntry from "../../notes/TimelineEntry";
import AttendeeAvatar from "./AttendeeAvatar";
import MeetingsDayOfWeekGraph from "./MeetingsDayOfWeekGraph";
import MeetingsHourOfDayGraph from "./MeetingsHourOfDayGraph";

const { Sider, Content } = Layout;

export interface DayViewProps {
  startDate: DateTime;
  breadcrumbs: Partial<BreadcrumbItemType>[];
}

const DayView: React.FunctionComponent<DayViewProps> = ({
  startDate,
  breadcrumbs,
}: DayViewProps) => {
  const searchParams = useSearchParams();

  const calendarRef = useRef<FullCalendar>(null);

  const [dayPickerCurrent, setDayPickerCurrent] = useState(startDate);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [targetEventId, setTargetEventId] = useState<string | undefined>(
    undefined,
  );
  const [event, setEvent] = useState<any>(undefined);
  const [eventNotes, setEventNotes] = useState([]);
  const [eventLoading, setEventLoading] = useState(false);
  const [summary, setSummary] = useState<any>(undefined);
  const [summaryLoading, setSummaryLoading] = useState(false);

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
      const rawEvents = await meetingsApi.getMeetings(start, 1);
      const parsedEvents: EventInput[] = [];

      rawEvents.data.items.forEach((rawEvent: any) => {
        const event = meetingsApi.toEvent(rawEvent);

        if (targetEventId && targetEventId === event.id) {
          ((event.classNames as string[]) || []).push("selected");
        }

        parsedEvents.push(event);
      });

      setEvents(parsedEvents);
      await loadSummary();
    })();
  }, [startDate]);

  useEffect(() => {
    (async () => {
      setEventLoading(true);

      try {
        if (targetEventId) {
          const response = await meetingsApi.getMeeting(targetEventId);
          setEvent(response.data.item);
          const notesResponse = await notesApi.getNotesForEntity(
            "meeting",
            targetEventId,
          );
          setEventNotes(notesResponse.data.notes);

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
        console.log(e);
      } finally {
        setEventLoading(false);
      }
    })();
  }, [targetEventId]);

  const loadSummary = async (quiet: boolean = false) => {
    if (!quiet) {
      setSummaryLoading(true);
    }

    try {
      const endOfView = startDate.endOf("month").endOf("week");
      const summaryResponse = await meetingsApi.getSummary(endOfView, 42);
      setSummary(summaryResponse.data);
    } catch (e) {
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
    } finally {
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
            showMetadata={false}
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
      <Space
        direction={"vertical"}
        size={8}
        style={{ width: "100%", paddingTop: 76 }}
      >
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
        <Space style={{ marginTop: 32, paddingLeft: 8 }}>
          <Typography.Title level={4} style={{ marginBottom: 0 }}>
            Notes
          </Typography.Title>
        </Space>
        <NotesEditorForm
          onClose={() => {}}
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
          showTitle={false}
          showSummary={false}
        />
        <Space
          direction={"vertical"}
          style={{
            width: "100%",
            paddingLeft: 8,
            overflowY: "scroll",
          }}
        >
          {notesContent}
        </Space>
      </Space>
    );
  } else {
    eventContent = <Empty description={"No event selected"} />;
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
            <Col span={10} style={{ height: "calc(100vh - 102px)" }}>
              <FullCalendar
                ref={calendarRef}
                plugins={[timeGridPlugin, listPlugin]}
                viewClassNames={"minerva-cal"}
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
                }}
              />
            </Col>
            <Col
              span={14}
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
            toMonth={dayPickerCurrent.toJSDate()}
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
          <Tabs
            defaultActiveKey={"today"}
            items={[
              {
                key: "today",
                label: "Today",
                children: (
                  <>
                    <MeetingsHourOfDayGraph
                      date={startDate}
                      summaryLoading={summaryLoading}
                      summary={summary}
                    />
                    <MeetingsDayOfWeekGraph
                      date={startDate}
                      summaryLoading={summaryLoading}
                      summary={summary}
                    />
                  </>
                ),
              },
              {
                key: "week",
                label: "This Week",
                children: "Content of Tab Pane 2",
              },
              {
                key: "month",
                label: "This Month",
                children: "Content of Tab Pane 3",
              },
            ]}
          />
        </Sider>
      </Layout>
    </Space>
  );
};
export default DayView;
