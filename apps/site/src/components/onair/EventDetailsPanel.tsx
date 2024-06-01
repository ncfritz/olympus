import { DeleteOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { EventImpl } from "@fullcalendar/core/internal";
import { Button, Empty, Space, Spin, Typography } from "antd";
import React from "react";
import EventActionButton from "./EventActionButton";
import OnAirEvent from "./OnAirEvent";
import OnAirOverrideEvent from "./OnAirOverrideEvent";

interface EventDetailsPanelProps {
  event?: EventImpl;
  loading: boolean;
  setStatus: (status: string) => Promise<void>;
  removeOverride: (id: string) => Promise<void>;
  doClose: () => void;
}

const EventDetailsPanel: React.FunctionComponent<EventDetailsPanelProps> = ({
  event,
  loading,
  setStatus,
  removeOverride,
  doClose,
}: EventDetailsPanelProps) => {
  let content = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  if (loading) {
    content = (
      <Space
        direction={"vertical"}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          marginTop: "64px",
        }}
      >
        <Spin spinning={true} size={"large"} />
        <Typography.Text>Saving...</Typography.Text>
      </Space>
    );
  } else if (event) {
    let className = "";

    if (event.extendedProps.type === "Override") {
      className = `oa-override-${event.extendedProps.status}`;
    } else {
      className = `oa-status-${event.extendedProps.status.toLowerCase()}`;
    }

    content = (
      <Space
        direction={"vertical"}
        style={{
          display: "flex",
          justifyContent: "space-between",
          height: "100%",
        }}
      >
        <Space
          direction={"vertical"}
          style={{ width: "100%", padding: 16 }}
          size={4}
        >
          <Typography.Title level={5}>Event</Typography.Title>
          <div
            className={"fc-timegrid-event-harness"}
            style={{
              height: 90,
              position: "relative",
            }}
          >
            <div
              className={` fc-event fc-event-start fc-event-end oa-event-detail ${className}`}
            >
              <div className={"fc-event-main"}>
                {event.extendedProps.type === "Override" ? (
                  <OnAirOverrideEvent
                    event={event}
                    openFunction={(e) => {
                      return;
                    }}
                    updateFunction={async (id, status, start, end) => {
                      return;
                    }}
                    removeFunction={async () => {
                      return;
                    }}
                  />
                ) : (
                  <OnAirEvent
                    event={event}
                    openFunction={() => {
                      return;
                    }}
                    updateFunction={async (id, status) => {
                      return;
                    }}
                  />
                )}
              </div>
            </div>
          </div>
          <Typography.Title level={5} style={{ marginTop: 32 }}>
            Status Override
          </Typography.Title>
          <EventActionButton
            event={event}
            status={"dnd"}
            label={"Do Not Disturb"}
            updateFunction={setStatus}
          />
          <EventActionButton
            event={event}
            status={"interrupt"}
            label={"Interruptable"}
            updateFunction={setStatus}
          />
          <EventActionButton
            event={event}
            status={"free"}
            label={"Free"}
            updateFunction={setStatus}
          />
          <EventActionButton
            event={event}
            status={"clear"}
            label={"Clear"}
            updateFunction={setStatus}
          />
          <Typography.Title level={5} style={{ marginTop: 32 }}>
            Raw Event
          </Typography.Title>
          <code
            style={{
              fontSize: 11,
              display: "inline-flex",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
              overflowWrap: "anywhere",
              borderWidth: 1,
              borderColor: "#dddddd",
              borderStyle: "dotted",
              color: "#999999",
              padding: 8,
              width: "100%",
            }}
          >
            {JSON.stringify(event, null, 2)}
          </code>
        </Space>
        <Space
          size={8}
          direction={"vertical"}
          style={{ width: "100%", padding: 16 }}
        >
          <Button
            size={"large"}
            block={true}
            type={"default"}
            onClick={() => {
              doClose();
            }}
          >
            <Space direction={"horizontal"} size={8}>
              <CloseCircleOutlined />
              Cancel
            </Space>
          </Button>
          {event &&
            event.extendedProps.type === "Override" &&
            event.extendedProps.isNew !== true && (
              <Button
                size={"large"}
                block={true}
                type={"primary"}
                danger={true}
                onClick={async () => {
                  await removeOverride(event.id);
                }}
              >
                <Space direction={"horizontal"} size={8}>
                  <DeleteOutlined />
                  Remove
                </Space>
              </Button>
            )}
        </Space>
      </Space>
    );
  }

  return content;
};
export default EventDetailsPanel;
