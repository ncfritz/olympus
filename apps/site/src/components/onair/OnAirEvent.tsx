import { EventImpl } from "@fullcalendar/core/internal";
import { Button, Popover, Space, Tag, Typography } from "antd";
import { DateTime } from "luxon";
import { useState } from "react";

interface OnAirEventProps {
  event: EventImpl;
  openFunction: (e: EventImpl) => void;
  updateFunction: (id: string, status: string) => Promise<void>;
}

const OnAirEvent: React.FunctionComponent<OnAirEventProps> = ({
  event,
  openFunction,
  updateFunction,
}: OnAirEventProps) => {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  const start = DateTime.fromJSDate(event.start!);
  const end = DateTime.fromJSDate(event.end!);
  const duration = end.diff(start);

  const setOverrideStatus = async (status: string) => {
    await updateFunction(event.id, status);
    setOpen(false);
  };

  let onairStatus = "clear";

  if (event.display === "background") {
    return <></>;
  }

  if (event.extendedProps.onairStatus) {
    onairStatus = event.extendedProps.onairStatus;
  } else {
    switch (event.extendedProps.status) {
      case "Tentative":
        onairStatus = "interrupt";
        break;
      case "Busy":
        onairStatus = "dnd";
        break;
      case "Free":
      case "OOF":
        onairStatus = "free";
        break;
    }
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
        size={4}
        direction={"horizontal"}
        align={"center"}
        style={{ overflow: "hidden", display: "flex" }}
      >
        <div
          className={`oa-light-status-${onairStatus}`}
          style={{ width: 10, height: 10, borderRadius: 12, marginLeft: 4 }}
        />
        <Typography.Text style={{ fontSize: "10px", whiteSpace: "nowrap" }}>
          {event.start?.toLocaleTimeString("en-us", {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          {event.end?.toLocaleTimeString("en-us", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Typography.Text>
        {duration.as("minute") <= 15 && (
          <Typography.Text
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
export default OnAirEvent;
