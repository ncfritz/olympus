import { EventImpl } from "@fullcalendar/core/internal";
import { Button, Space } from "antd";
import React from "react";
import { getColorForStatus } from "../../utils/onair";

interface EventActionButtonProps {
  event: EventImpl;
  status: string;
  label: string;
  updateFunction: (status: string) => Promise<void>;
}

const EventActionButtion: React.FunctionComponent<EventActionButtonProps> = ({
  event,
  status,
  label,
  updateFunction,
}: EventActionButtonProps) => {
  return (
    <Button
      size={"large"}
      block={true}
      type={event?.extendedProps.onairStatus === status ? "primary" : "default"}
      onClick={async () => {
        await updateFunction(status);
      }}
      style={{
        display: "flex",
        alignItems: "start",
      }}
    >
      <Space direction={"horizontal"} style={{ width: "100%" }} size={8}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 32,
            backgroundColor: getColorForStatus(status),
          }}
        />
        {label}
      </Space>
    </Button>
  );
};
export default EventActionButtion;
