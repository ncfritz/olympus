"use client";

import { Button, Card, Select, Space, Switch, Table, Tag } from "antd";
import { useState } from "react";
import useSWR from "swr";
import { fetchEvents, type CalendarStatus, type EventDto } from "@/lib/api/queries";
import { EventDetailDrawer } from "./EventDetailDrawer";

const EVENT_LIMIT = 200;

export function EventsPanel({ calendars }: { calendars: CalendarStatus[] }) {
  const [source, setSource] = useState<string | undefined>(undefined);
  const [showCancelled, setShowCancelled] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selected, setSelected] = useState<EventDto | null>(null);

  const filters = { source, showCancelled, showDeleted, limit: EVENT_LIMIT };
  const {
    data: events = [],
    isLoading,
    mutate,
  } = useSWR(["/events", filters], ([, f]) => fetchEvents(f));

  return (
    <Card
      title="Events"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="All sources"
            style={{ width: 220 }}
            value={source}
            onChange={setSource}
            options={calendars.map((c) => ({ label: c.source, value: c.source }))}
          />
          <Space size="small">
            <Switch checked={showCancelled} onChange={setShowCancelled} size="small" />
            <span>Cancelled</span>
          </Space>
          <Space size="small">
            <Switch checked={showDeleted} onChange={setShowDeleted} size="small" />
            <span>Deleted</span>
          </Space>
          <Button onClick={() => mutate()} loading={isLoading}>
            Refresh
          </Button>
        </Space>
      }
    >
      <Table<EventDto>
        rowKey="id"
        loading={isLoading}
        dataSource={events}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true }}
        onRow={(record) => ({ onClick: () => setSelected(record) })}
        rowClassName={() => "clickable-row"}
        columns={[
          { title: "Subject", dataIndex: "subject" },
          { title: "Source", dataIndex: "source" },
          {
            title: "Start",
            dataIndex: "startTime",
            render: (value: string) => new Date(value).toLocaleString(),
            sorter: (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime),
            defaultSortOrder: "descend",
          },
          {
            title: "Status",
            key: "status",
            render: (_, record) => (
              <Space size="small">
                {record.cancelled && <Tag color="orange">Cancelled</Tag>}
                {record.deleted && <Tag color="red">Deleted</Tag>}
                {!record.cancelled && !record.deleted && <Tag color="blue">{record.status}</Tag>}
              </Space>
            ),
          },
          { title: "Type", dataIndex: "type" },
        ]}
      />
      {events.length >= EVENT_LIMIT && (
        <p style={{ marginTop: 8, color: "#888" }}>
          Showing the first {EVENT_LIMIT} matching events — narrow the filters above to see more specific results.
        </p>
      )}
      <EventDetailDrawer event={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}
