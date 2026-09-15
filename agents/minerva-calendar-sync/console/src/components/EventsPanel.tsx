"use client";

import { Button, Card, Checkbox, Flex, Segmented, Space, Switch, Table, Tag, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { fetchEvents, type CalendarStatus, type EventDto } from "@/lib/api/queries";
import { EventDetailDrawer } from "./EventDetailDrawer";
import { EventsCalendarView, type CalendarViewMode } from "./EventsCalendarView";

const EVENT_LIMIT = 200;

type ViewMode = "list" | CalendarViewMode;

const VIEW_OPTIONS: { label: string; value: ViewMode }[] = [
  { label: "List", value: "list" },
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
  { label: "Day", value: "day" },
];

export function EventsPanel({ calendars }: { calendars: CalendarStatus[] }) {
  const [view, setView] = useState<ViewMode>("week");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const knownSources = useRef<Set<string>>(new Set());
  const [showCancelled, setShowCancelled] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selected, setSelected] = useState<EventDto | null>(null);

  // Auto-select newly-seen sources (including the initial load) without
  // clobbering sources the user has already unchecked.
  useEffect(() => {
    const newSources = calendars.map((c) => c.source).filter((s) => !knownSources.current.has(s));
    if (newSources.length > 0) {
      newSources.forEach((s) => knownSources.current.add(s));
      setSelectedSources((prev) => [...prev, ...newSources]);
    }
  }, [calendars]);

  const filters = { showCancelled, showDeleted, limit: EVENT_LIMIT };
  const {
    data: events = [],
    isLoading,
    mutate,
  } = useSWR(["/events", filters], ([, f]) => fetchEvents(f));

  const filteredEvents = events.filter((e) => selectedSources.includes(e.source));

  return (
    <Card
      title="Events"
      extra={
        <Space>
          <Segmented options={VIEW_OPTIONS} value={view} onChange={(value) => setView(value as ViewMode)} />
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
      <Flex gap="large" align="flex-start">
        <div style={{ width: 180, flexShrink: 0 }}>
          <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
            <Typography.Text strong>Sources</Typography.Text>
            <Space size="small">
              <Typography.Link
                style={{ fontSize: 12 }}
                onClick={() => setSelectedSources(calendars.map((c) => c.source))}
              >
                All
              </Typography.Link>
              <Typography.Link style={{ fontSize: 12 }} onClick={() => setSelectedSources([])}>
                None
              </Typography.Link>
            </Space>
          </Flex>
          <Checkbox.Group
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
            value={selectedSources}
            onChange={(values) => setSelectedSources(values as string[])}
            options={calendars.map((c) => ({ label: c.source, value: c.source }))}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {view === "list" ? (
            <Table<EventDto>
              rowKey="id"
              loading={isLoading}
              dataSource={filteredEvents}
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
          ) : (
            <EventsCalendarView mode={view} events={filteredEvents} onSelectEvent={setSelected} />
          )}
          {events.length >= EVENT_LIMIT && (
            <p style={{ marginTop: 8, color: "#888" }}>
              Showing the first {EVENT_LIMIT} matching events — narrow the filters above to see more specific
              results.
            </p>
          )}
        </div>
      </Flex>
      <EventDetailDrawer event={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}
