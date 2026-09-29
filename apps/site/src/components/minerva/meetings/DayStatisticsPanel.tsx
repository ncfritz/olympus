import { CaretDownOutlined, CaretRightOutlined } from "@ant-design/icons";
import type { ItemType } from "@rc-component/collapse/lib/interface";
import { Avatar, Collapse, Empty, Flex, Space, Typography } from "antd";
import React, { useEffect, useState } from "react";
import type { Meeting } from "@ncfritz/olympus-sdk/minerva";
import EventChip from "./EventChip";

export interface DayStatisticsPanelProps {
  events: Meeting[];
  onEventClick?: (event: Meeting) => Promise<void>;
}

interface AttendeeCount {
  email: string;
  alias: string;
  name: string;
  count: number;
  events: Meeting[];
}

const DayStatisticsPanel: React.FunctionComponent<DayStatisticsPanelProps> = ({
  events,
  onEventClick,
}) => {
  const [topAttendees, setTopAttendees] = useState<AttendeeCount[]>([]);

  useEffect(() => {
    const attendeeCounts: Record<string, AttendeeCount> = {};

    if (events && events.length > 0) {
      events.forEach((event) => {
        if (event.isAllDay) {
          return;
        }

        if (event.attendees.length > 100) {
          return;
        }

        event.attendees.forEach((attendee) => {
          if (attendee.type !== "Mailbox" || attendee.alias === "ncfritz") {
            return;
          }

          // Without an alias there is nothing to count an attendee under; they
          // would otherwise all collapse into a single unnamed bucket.
          if (!attendee.alias) {
            return;
          }

          const alias = attendee.alias;

          if (!Object.keys(attendeeCounts).includes(alias)) {
            attendeeCounts[alias] = {
              email: attendee.email,
              alias: alias,
              name: `${attendee.givenName} ${attendee.surname}`,
              count: 1,
              events: [event],
            };
          } else {
            attendeeCounts[alias].count++;
            attendeeCounts[alias].events.push(event);
          }
        });
      });
    }

    setTopAttendees(Object.values(attendeeCounts));
  }, [events]);

  let attendeeContents;

  if (topAttendees.length <= 0) {
    attendeeContents = (
      <Space
        direction={"horizontal"}
        style={{ width: "100%", justifyContent: "center" }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={"No notes to display for this meeting."}
        />
      </Space>
    );
  } else {
    const attendeeItems: ItemType[] = [];
    topAttendees
      .sort((a, b) => {
        return b.count - a.count;
      })
      .forEach((attendee) => {
        attendeeItems.push({
          key: attendee.alias,
          label: (
            <Flex
              vertical={false}
              style={{ alignItems: "center", width: "100%", columnGap: 8 }}
            >
              <Avatar
                shape={"square"}
                size={"default"}
                src={`https://cdn.internal.ncfritz.net/amzn/avatar/${attendee.alias}.jpg`}
              />
              <Flex vertical={false} flex={1}>
                <Space
                  direction={"vertical"}
                  size={0}
                  style={{ width: "100%" }}
                  styles={{ item: { lineHeight: 1 } }}
                >
                  <Typography.Text style={{ fontSize: 12 }}>
                    {attendee.name}
                  </Typography.Text>
                  <Typography.Text style={{ fontSize: 11 }}>
                    {attendee.email}
                  </Typography.Text>
                </Space>
              </Flex>
              <Space
                style={{
                  background: "#efefef",
                  width: 40,
                  maxWidth: 40,
                  justifyContent: "center",
                  fontWeight: 700,
                  height: 32,
                  borderRadius: 5,
                }}
              >
                {attendee.count}
              </Space>
            </Flex>
          ),
          children: [
            <Space
              size={6}
              direction={"vertical"}
              style={{
                width: "100%",
                marginTop: 8,
                paddingLeft: 24,
                marginBottom: 8,
              }}
            >
              {attendee.events.map((event) => {
                return <EventChip event={event} onClick={onEventClick} />;
              })}
            </Space>,
          ],
        });
      });

    attendeeContents = (
      <Collapse
        style={{ padding: 8 }}
        defaultActiveKey={undefined}
        expandIcon={(panelProps) => {
          return panelProps.isActive ? (
            <CaretDownOutlined />
          ) : (
            <CaretRightOutlined />
          );
        }}
        ghost={true}
        items={attendeeItems}
      />
    );
  }

  return (
    <Space orientation={"vertical"} style={{ width: "100%" }}>
      <Space orientation={"vertical"} style={{ width: "100%" }}>
        <Typography.Text strong={true} style={{ marginLeft: 8 }}>
          Top Attendees:
        </Typography.Text>
        <Space
          size={4}
          direction={"vertical"}
          style={{ width: "100%", maxHeight: 553, overflowY: "scroll" }}
        >
          {attendeeContents}
        </Space>
      </Space>
    </Space>
  );
};
export default DayStatisticsPanel;
