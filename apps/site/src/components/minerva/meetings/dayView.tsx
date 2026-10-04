import {
  BarChartOutlined,
  CalendarOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  ScheduleOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { EventInput } from "@fullcalendar/core";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { type Note } from "@ncfritz/olympus-sdk/minerva";
import {
  Avatar,
  Col,
  Collapse,
  Empty,
  Flex,
  Row,
  Space,
  Spin,
  Switch,
  Tabs,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import meetingsApi from "../../../api/meetingsApi";
import notesApi from "../../../api/notestApi";
import { Events, publish } from "../../../utils/events";
import { organizerOf, periodOf } from "../../../utils/meetings";
import NotesEditorForm, {
  type NotesFormInput,
} from "../../notes/NotesEditorForm";
import TimelineEntry from "../../notes/TimelineEntry";
import AttendeeAvatar from "./AttendeeAvatar";
import DayStatisticsPanel from "./DayStatisticsPanel";
import EventChip from "./EventChip";
import MeetingsDayPicker from "./MeetingsDayPicker";
import MeetingsPage from "./MeetingsPage";
import MeetingStatisticsPanel from "./MeetingsStatisticsPanel";
import PreviousMeeting from "./PreviousMeeting";

export interface DayViewProps {
  /** The day to show. */
  startDate: DateTime;
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
}: DayViewProps) => {
  const searchParams = useSearchParams();

  const calendarRef = useRef<FullCalendar>(null);

  const selectedDate = startDate;
  const [rawEvents, setRawEvents] = useState<RawMeeting[]>();
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
      } catch {
        setRawEvents([]);
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

  const toggleNotesEditor = () => {
    setNotedEditorOpen(!notedEditorOpen);
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
                src={organizerOf(event).avatar}
                icon={<UserOutlined />}
              />
              <Space orientation={"vertical"} size={0}>
                <Typography.Title
                  level={5}
                  style={{ paddingBottom: 2, margin: 0 }}
                >
                  {organizerOf(event).name}
                </Typography.Title>
                <Typography.Text strong={true}>
                  {organizerOf(event).email}
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

  const week = periodOf("week", startDate);
  const month = periodOf("month", startDate);

  return (
    <MeetingsPage
      view={"day"}
      date={startDate}
      items={rawEvents}
      tabs={[
        {
          key: "calendar",
          label: <CalendarOutlined />,
          children: (
            <Space orientation={"vertical"} style={{ width: "100%" }}>
              <MeetingsDayPicker view={"day"} date={startDate} />
              {nextEventInSeries && (
                <Space
                  orientation={"vertical"}
                  style={{ padding: 8, width: "100%" }}
                >
                  <EventChip event={nextEventInSeries} />
                </Space>
              )}
            </Space>
          ),
        },
        {
          key: "day",
          label: <ScheduleOutlined />,
          children: (
            <DayStatisticsPanel
              events={rawEvents ?? []}
              onEventClick={async (clicked) => {
                setTargetEventId(clicked.id);
              }}
            />
          ),
        },
        {
          key: "statistics",
          label: <BarChartOutlined />,
          children: (
            <Tabs
              defaultActiveKey={"week"}
              items={[
                {
                  key: "week",
                  label: "Week",
                  children: (
                    <MeetingStatisticsPanel
                      startDate={week.start}
                      dayCount={week.days}
                    />
                  ),
                },
                {
                  key: "month",
                  label: "Month",
                  children: (
                    <MeetingStatisticsPanel
                      startDate={month.from}
                      dayCount={Math.round(
                        month.to.diff(month.from, "days").days,
                      )}
                    />
                  ),
                },
              ]}
            />
          ),
        },
        {
          key: "settings",
          label: <SettingOutlined />,
          children: (
            <Flex
              justify={"space-between"}
              align={"center"}
              style={{ padding: 16 }}
            >
              <Typography.Text>Show note metadata</Typography.Text>
              <Switch
                checked={showMeta}
                onChange={(checked) => {
                  setShowMeta(checked);
                }}
              />
            </Flex>
          ),
        },
      ]}
    >
      <Row style={{ height: "100%" }}>
        <Col span={7} style={{ height: "100%" }}>
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, listPlugin]}
            viewClassNames={"minerva-cal hide-day-header"}
            eventClassNames={(arg) =>
              targetEventId && arg.event.id === targetEventId ? "selected" : ""
            }
            initialDate={selectedDate.toJSDate()}
            events={events}
            initialView={"timeGridDay"}
            height={"100%"}
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5],
              startTime: "9:00",
              endTime: "17:00",
            }}
            headerToolbar={false}
            scrollTime={"08:00:00"}
            nowIndicator={true}
            slotDuration={{ minutes: 15 }}
            eventClick={(arg) => {
              setTargetEventId(arg.event.id);
            }}
          />
        </Col>
        <Col
          span={17}
          style={{
            height: "100%",
            overflowY: "auto",
            borderLeft: "1px solid #f0f0f0",
          }}
        >
          {eventContent}
        </Col>
      </Row>
    </MeetingsPage>
  );
};
export default DayView;
