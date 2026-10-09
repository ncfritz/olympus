import { ArrowLeftOutlined } from "@ant-design/icons";
import { EventImpl } from "@fullcalendar/core/internal";
import { Button, Drawer, notification, Space } from "antd";
import { useEffect, useState } from "react";
import availabilityApi from "../../api/availabilityApi";
import { signalStatus, toLevel } from "../../utils/onair";
import CalendarPanel from "./CalendarPanel";
import EventDetailsPanel from "./EventDetailsPanel";

export interface OnAirDrawerProps {
  open: boolean;
  onClose: () => void;
}

const OnAirDrawer: React.FunctionComponent<OnAirDrawerProps> = ({
  open,
  onClose,
}: OnAirDrawerProps) => {
  const [messageApi] = notification.useNotification();

  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [, setEventsError] = useState<any>(undefined);
  const [targetEvent, setTargetEvent] = useState<EventImpl | undefined>(
    undefined,
  );
  const [rangeStart, setRangeStart] = useState<any>();
  const [rangeEnd, setRangeEnd] = useState<any>();

  const fetchEvents = async (quiet = false) => {
    if (!quiet) {
      setEventsLoading(true);
    }
    setEventsError(undefined);

    try {
      const data = await availabilityApi.events();
      const signalEvents = [];

      for (const key in data.signals) {
        const start = new Date(parseInt(key) * 60 * 15 * 1000);
        const end = new Date(start.getTime() + 60 * 15 * 1000);
        const status = signalStatus(data.signals[key]);

        signalEvents.push({
          id: `signal-${key}`,
          display: "background",
          start: start,
          end: end,
          editable: false,
          classNames: ["oa-signal-event", `oa-signal-${status}`],
        });
      }

      setEvents([...signalEvents, ...data.events, ...data.overrides]);
      setRangeStart(data.start);
      setRangeEnd(data.end);
    } catch (e) {
      setEventsError(e);
      messageApi.open({
        type: "error",
        message: "Unable to load events",
      });
    } finally {
      setEventsLoading(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!targetEvent) {
      return;
    }

    setEventsLoading(true);

    try {
      if (targetEvent.extendedProps.type === "Override") {
        await updateOverride(
          targetEvent.id,
          status,
          targetEvent.start!,
          targetEvent.end!,
        );
      } else {
        await updateEventStatus(targetEvent.id, status);
      }

      await fetchEvents();
      setTargetEvent(undefined);
    } finally {
      setEventsLoading(false);
    }
  };

  // Clear on a meeting goes back to its calendar's status.
  const updateEventStatus = async (id: string, status: string) => {
    if (status === "clear") {
      await availabilityApi.clearMeetingLevel(id);
    } else {
      await availabilityApi.setMeetingLevel(id, toLevel(status));
    }

    messageApi.open({
      type: "success",
      message: "Event status set successfully",
    });
  };

  const updateOverride = async (
    id: string,
    status: string,
    start: Date,
    end: Date,
  ) => {
    await availabilityApi.saveBlock(id, toLevel(status), start, end);

    messageApi.open({
      type: "success",
      message: "Override created successfully",
    });
  };

  const removeOverride = async (id: string) => {
    setEventsLoading(true);

    try {
      await availabilityApi.deleteBlock(id);

      messageApi.open({
        type: "success",
        message: "Override removed successfully",
      });

      await fetchEvents();
      setTargetEvent(undefined);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    (async () => {
      await fetchEvents();

      interval = setInterval(async () => {
        await fetchEvents(true);
      }, 30000);
    })();

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  let title = "OnAir - Events";
  let content;
  let extra = undefined;

  if (targetEvent) {
    title = "OnAir - Edit event";
    content = (
      <EventDetailsPanel
        loading={eventsLoading}
        event={targetEvent}
        setStatus={setStatus}
        removeOverride={removeOverride}
        doClose={() => {
          setTargetEvent(undefined);
        }}
      />
    );
    extra = (
      <Space>
        <Button
          type={"text"}
          onClick={() => {
            setTargetEvent(undefined);
          }}
          icon={<ArrowLeftOutlined />}
        >
          Back to calendar
        </Button>
      </Space>
    );
  } else {
    content = (
      <CalendarPanel
        loading={eventsLoading}
        events={events}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        setTargetEvent={setTargetEvent}
        updateOverride={updateOverride}
        fetchEvents={fetchEvents}
        removeOverride={removeOverride}
        updateEventStatus={updateEventStatus}
      />
    );
  }

  return (
    <Drawer
      title={title}
      placement={"right"}
      width={600}
      onClose={() => {
        onClose();
      }}
      open={open}
      styles={{
        body: {
          padding: 0,
        },
      }}
      extra={extra}
    >
      {content}
    </Drawer>
  );
};
export default OnAirDrawer;
