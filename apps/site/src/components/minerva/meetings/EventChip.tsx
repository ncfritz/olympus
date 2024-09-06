import { CalendarOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { Space, Typography } from "antd";
import { DateTime } from "luxon";
import React, { type CSSProperties } from "react";

export interface EventChipProps {
  event: any;
  titleOverride?: string;
  style?: CSSProperties;
}

const EventChip: React.FunctionComponent<EventChipProps> = ({
  event,
  titleOverride,
  style,
}) => {
  const start = DateTime.fromISO(event.startTime);
  const end = DateTime.fromISO(event.endTime);

  return (
    <Space
      size={2}
      direction={"vertical"}
      className={`oa-event oa-status-${event.status.toLowerCase()} minerva-event no-gutter`}
      style={{
        width: "100%",
        position: "relative",
        borderRadius: 6,
        ...style,
      }}
    >
      <Typography.Title level={5} style={{ marginBottom: 2, fontSize: 12 }}>
        {titleOverride ? titleOverride : event.subject}
      </Typography.Title>
      <Space direction={"horizontal"} size={8}>
        <CalendarOutlined />
        <Typography.Text style={{ fontSize: "12px" }}>
          {start.toFormat("DDDD")}
        </Typography.Text>
      </Space>
      <Space direction={"horizontal"} size={8}>
        <ClockCircleOutlined />
        <Typography.Text style={{ fontSize: "12px" }}>
          {start.toFormat("t")} - {end.toFormat("t")}
        </Typography.Text>
      </Space>
    </Space>
  );
};
export default EventChip;
