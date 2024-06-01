import { DeleteOutlined } from "@ant-design/icons";
import { EventImpl } from "@fullcalendar/core/internal";
import { Button, Divider, Popover, Space, Tag, Typography } from "antd";
import { DateTime } from "luxon";
import { useState } from "react";

interface OnAirOverrideEventProps {
  event: EventImpl;
  openFunction: (e: EventImpl) => void;
  updateFunction: (
    id: string,
    status: string,
    start: Date,
    end: Date,
  ) => Promise<void>;
  removeFunction: (id: string) => Promise<void>;
}

const OnAirOverrideEvent: React.FunctionComponent<OnAirOverrideEventProps> = ({
  event,
  openFunction,
  updateFunction,
  removeFunction,
}: OnAirOverrideEventProps) => {
  const start = DateTime.fromJSDate(event.start!);
  const end = DateTime.fromJSDate(event.end!);
  const duration = end.diff(start);

  if (event.display === "background") {
    return <></>;
  }

  return (
    <Space
      direction={"vertical"}
      size={1}
      style={{ width: "100%", height: "100%" }}
      onClick={() => {
        openFunction(event);
      }}
    >
      <Space
        size={2}
        direction={"horizontal"}
        align={"center"}
        style={{
          overflow: "hidden",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Space direction={"horizontal"}>
          <div
            className={`oa-light-status-${
              event.extendedProps.status || "clear"
            }`}
            style={{ width: 10, height: 10, borderRadius: 12, marginLeft: 4 }}
          />
          <Typography.Text style={{ fontSize: "10px", whiteSpace: "nowrap" }}>
            {event.start?.toLocaleTimeString()} -{" "}
            {event.end?.toLocaleTimeString()}
          </Typography.Text>
          {duration.as("minute") <= 15 && (
            <Typography.Text
              strong={true}
              style={{
                fontSize: "12px",
                marginLeft: 18,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {event.extendedProps.subject}
            </Typography.Text>
          )}
        </Space>
      </Space>
      {duration.as("minute") > 15 && (
        <Typography.Text
          strong={true}
          style={{
            fontSize: "12px",
            marginLeft: 18,
            textOverflow: "ellipsis",
          }}
        >
          {event.extendedProps.subject}
        </Typography.Text>
      )}
    </Space>
  );
};
export default OnAirOverrideEvent;
