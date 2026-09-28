import { CalendarOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { Space, Typography } from "antd";
import { DateTime } from "luxon";
import React, { type CSSProperties } from "react";
import styled from "styled-components";

export interface EventChipProps {
  event: any;
  onClick?: (event: any) => Promise<void>;
  titleOverride?: string;
  style?: CSSProperties;
}

const HoverableSpace = styled(Space)`
  &:hover {
    background-color: #fffbf0;
  }
`;

const EventChip: React.FunctionComponent<EventChipProps> = ({
  event,
  onClick,
  titleOverride,
  style,
}) => {
  const start = DateTime.fromISO(event.startTime);
  const end = DateTime.fromISO(event.endTime);

  return (
    <HoverableSpace
      size={2}
      direction={"vertical"}
      className={`oa-event oa-status-${event.status.toLowerCase()} minerva-event no-gutter`}
      style={{
        width: "100%",
        position: "relative",
        borderRadius: 6,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
      onClick={async () => {
        if (onClick) {
          await onClick(event);
        }
      }}
    >
      <Typography.Title level={5} style={{ marginBottom: 2, fontSize: 12 }}>
        {titleOverride ? titleOverride : event.subject}
      </Typography.Title>
      <Space orientation={"horizontal"} size={8}>
        <CalendarOutlined />
        <Typography.Text style={{ fontSize: "12px" }}>
          {start.toFormat("DDDD")}
        </Typography.Text>
      </Space>
      <Space orientation={"horizontal"} size={8}>
        <ClockCircleOutlined />
        <Typography.Text style={{ fontSize: "12px" }}>
          {start.toFormat("t")} - {end.toFormat("t")}
        </Typography.Text>
      </Space>
    </HoverableSpace>
  );
};
export default EventChip;
