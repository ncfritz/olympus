"use client";

import { Descriptions, Drawer, Tag } from "antd";
import type { components } from "@/lib/api/schema";

type EventDto = components["schemas"]["EventResponseDto"];

export function EventDetailDrawer({ event, onClose }: { event: EventDto | null; onClose: () => void }) {
  return (
    <Drawer title={event?.subject} open={event !== null} onClose={onClose} size={480}>
      {event && (
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
          <Descriptions.Item label="UID">{event.uid}</Descriptions.Item>
        </Descriptions>
      )}
    </Drawer>
  );
}
