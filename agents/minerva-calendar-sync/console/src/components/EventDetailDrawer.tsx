"use client";

import { Descriptions, Divider, Drawer, Flex, Space, Tag, theme, Typography } from "antd";
import useSWR from "swr";
import type { components } from "@/lib/api/schema";
import type { AvailabilityStatus } from "@/lib/api/queries";
import { fetchEventPublishStatus } from "@/lib/api/queries";
import { statusDotColor } from "@/lib/availability";
import { OverrideStatusPicker } from "./OverrideStatusPicker";

type EventDto = components["schemas"]["EventResponseDto"];

const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  none: "None",
  free: "Free",
  interruptable: "Interruptable",
  busy: "Busy",
};

const PUBLISH_STATUS_TAG: Record<string, string> = {
  pending: "processing",
  sent: "success",
  failed: "error",
};

export function EventDetailDrawer({
  event,
  status,
  hasOverride,
  currentOverride,
  onOptimisticOverrideChange,
  onSelectOverride,
  onClearOverride,
  onClose,
}: {
  event: EventDto | null;
  status: AvailabilityStatus | null;
  hasOverride: boolean;
  currentOverride: AvailabilityStatus | null;
  onOptimisticOverrideChange: (status: AvailabilityStatus | null) => void;
  onSelectOverride: (status: AvailabilityStatus) => Promise<void>;
  onClearOverride: () => Promise<void>;
  onClose: () => void;
}) {
  const { token } = theme.useToken();
  const { data: publishStatus } = useSWR(
    event ? ["/outbox/events", event.source, event.uid] : null,
    ([, source, uid]) => fetchEventPublishStatus(source, uid),
  );

  return (
    <Drawer title={event?.subject} open={event !== null} onClose={onClose} size={480}>
      {event && (
        <>
          {status && (
            <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
              <Space align="center">
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: statusDotColor(status),
                    border: `1px solid ${token.colorBorderSecondary}`,
                    flexShrink: 0,
                  }}
                />
                <Typography.Text>{STATUS_LABEL[status]}</Typography.Text>
              </Space>
              {hasOverride && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  (Override)
                </Typography.Text>
              )}
            </Flex>
          )}

          <Divider style={{ margin: "12px 0" }}>Override</Divider>
          <OverrideStatusPicker
            currentOverride={currentOverride}
            onOptimisticChange={onOptimisticOverrideChange}
            onSelect={onSelectOverride}
            onClear={onClearOverride}
          />
          <Divider style={{ margin: "12px 0" }} />

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Subject">{event.subject}</Descriptions.Item>
            <Descriptions.Item label="Source">{event.source}</Descriptions.Item>
            <Descriptions.Item label="Start">{new Date(event.startTime).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="End">{new Date(event.endTime).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Duration">{event.duration} min</Descriptions.Item>
            <Descriptions.Item label="All day">{event.allDay ? "Yes" : "No"}</Descriptions.Item>
            <Descriptions.Item label="Location">{event.location ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Organizer">{event.organizerEmail ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Status">{event.status}</Descriptions.Item>
            <Descriptions.Item label="Sensitivity">{event.sensitivity}</Descriptions.Item>
            <Descriptions.Item label="Importance">{event.importance}</Descriptions.Item>
            <Descriptions.Item label="Type">{event.type}</Descriptions.Item>
            <Descriptions.Item label="Occurrence">{event.occurrenceType}</Descriptions.Item>
            <Descriptions.Item label="Recurrence ID">{event.recurrenceId ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Response">{event.response}</Descriptions.Item>
            <Descriptions.Item label="Reminder">{event.reminder ? "Yes" : "No"}</Descriptions.Item>
            <Descriptions.Item label="Cancelled">
              {event.cancelled ? <Tag color="orange">Cancelled</Tag> : "No"}
            </Descriptions.Item>
            <Descriptions.Item label="Deleted">
              {event.deleted ? <Tag color="red">Deleted</Tag> : "No"}
            </Descriptions.Item>
            {publishStatus?.enabled && (
              <Descriptions.Item label="Publish status">
                {publishStatus.latest ? (
                  <Tag color={PUBLISH_STATUS_TAG[publishStatus.latest.status] ?? "default"}>
                    {publishStatus.latest.status}
                  </Tag>
                ) : (
                  <Typography.Text type="secondary">Not yet queued</Typography.Text>
                )}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="UID">{event.uid}</Descriptions.Item>
          </Descriptions>
        </>
      )}
    </Drawer>
  );
}
