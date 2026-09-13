"use client";

import { Button, Card, message, Table, Tag } from "antd";
import { useState } from "react";
import { triggerCalendarSync, type CalendarStatus } from "@/lib/api/queries";

export function CalendarsPanel({
  calendars,
  loading,
  onRefresh,
}: {
  calendars: CalendarStatus[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function handleSync(calendarId: string) {
    setSyncingId(calendarId);
    const ok = await triggerCalendarSync(calendarId);
    setSyncingId(null);

    if (ok) {
      message.success(`Sync triggered for "${calendarId}"`);
      setTimeout(onRefresh, 2000);
    } else {
      message.error(`Failed to trigger sync for "${calendarId}"`);
    }
  }

  return (
    <Card
      title="Calendars"
      extra={
        <Button onClick={onRefresh} loading={loading}>
          Refresh
        </Button>
      }
    >
      <Table<CalendarStatus>
        rowKey="calendarId"
        loading={loading}
        dataSource={calendars}
        pagination={false}
        size="small"
        columns={[
          { title: "Source", dataIndex: "source" },
          { title: "Provider", dataIndex: "provider" },
          { title: "Account", dataIndex: "accountLabel" },
          { title: "Calendar ID", dataIndex: "calendarId" },
          {
            title: "Status",
            dataIndex: "synced",
            render: (synced: boolean) =>
              synced ? <Tag color="green">Synced</Tag> : <Tag color="orange">Not yet synced</Tag>,
          },
          {
            title: "",
            key: "actions",
            render: (_, record) => (
              <Button size="small" loading={syncingId === record.calendarId} onClick={() => handleSync(record.calendarId)}>
                Sync now
              </Button>
            ),
          },
        ]}
      />
    </Card>
  );
}
