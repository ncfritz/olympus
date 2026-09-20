"use client";

import { ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Flex,
  message,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useMemo } from "react";
import useSWR from "swr";
import {
  backfillCalendar,
  fetchCalendars,
  fetchFailedOutboxRecords,
  fetchOutboxSummary,
  requeueOutboxRecord,
  type OutboxRecord,
  type OutboxSourceStats,
} from "@/lib/api/queries";
import { PROVIDER_META, ProviderIcon, type Provider } from "@/lib/providerMeta";
import { useCalendarColors } from "@/lib/useCalendarColors";
import { AppLayout } from "./AppLayout";

const SOURCE_SWATCH_SIZE = 16;
const FAILED_LIMIT = 100;
const CALENDAR_COLUMN_WIDTH = 220;
const PROVIDER_COLUMN_WIDTH = 160;
const COUNT_COLUMN_WIDTH = 90;
const ATTEMPTS_COLUMN_WIDTH = 100;
const BACKFILL_COLUMN_WIDTH = 120;

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Right-aligned numeric columns (Sent/Pending/Failed/Attempts) render their value in monospace. */
function renderMonoNumber(value: number) {
  return <span style={{ fontFamily: "monospace" }}>{value}</span>;
}

export function PublishPage() {
  const { colorForSource } = useCalendarColors();
  const { data: calendars = [] } = useSWR("/calendars", fetchCalendars);
  const providerBySource = useMemo(
    () => new Map(calendars.map((c) => [c.source, c.provider as Provider])),
    [calendars],
  );

  const {
    data: summary,
    isLoading: summaryLoading,
    mutate: mutateSummary,
  } = useSWR("/outbox/summary", fetchOutboxSummary);
  const {
    data: failed = [],
    isLoading: failedLoading,
    mutate: mutateFailed,
  } = useSWR(
    summary?.enabled ? ["/outbox/failed", FAILED_LIMIT] : null,
    () => fetchFailedOutboxRecords(FAILED_LIMIT),
  );

  const handleBackfill = async (calendarId: string, source: string) => {
    try {
      const result = await backfillCalendar(calendarId);
      message.success(
        result.truncated
          ? `Queued the ${result.enqueued} most recent events for "${source}" (calendar exceeds the backfill cap)`
          : `Queued ${result.enqueued} event(s) for "${source}"`,
      );
      mutateSummary();
    } catch {
      message.error(`Failed to start a backfill for "${source}"`);
    }
  };

  const handleRequeue = async (id: string) => {
    try {
      await requeueOutboxRecord(id);
      message.success("Requeued — the dispatcher will retry it shortly");
      mutateFailed();
      mutateSummary();
    } catch {
      message.error("Failed to requeue that row");
    }
  };

  const renderCalendar = (value: string) => (
    <Flex align="center" gap={8}>
      <div
        style={{
          width: SOURCE_SWATCH_SIZE,
          height: SOURCE_SWATCH_SIZE,
          flexShrink: 0,
          borderRadius: 6,
          backgroundColor: colorForSource(value),
          border: "1px solid rgba(0, 0, 0, 0.15)",
        }}
      />
      <span>{value}</span>
    </Flex>
  );

  const renderProvider = (source: string) => {
    const provider = providerBySource.get(source);
    if (!provider) return "—";
    return (
      <Space size="small" align="center">
        <ProviderIcon provider={provider} size={16} />
        <span>{PROVIDER_META[provider].label}</span>
      </Space>
    );
  };

  return (
    <AppLayout>
      <Card
        title="Publish"
        style={{ borderRadius: 0 }}
        extra={
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => {
              mutateSummary();
              mutateFailed();
            }}
            loading={summaryLoading}
            aria-label="Refresh"
          />
        }
      >
        {!summaryLoading && summary && !summary.enabled && (
          <Alert
            type="info"
            showIcon
            message="Outbound sync isn't configured"
            description="Set RABBITMQ_URL to publish event changes onward to an external system. Inbound calendar sync is unaffected either way."
            style={{ marginBottom: 16 }}
          />
        )}

        <Table<OutboxSourceStats>
          rowKey="source"
          loading={summaryLoading}
          dataSource={summary?.sources ?? []}
          pagination={false}
          size="small"
          columns={[
            {
              title: "Calendar",
              dataIndex: "source",
              width: CALENDAR_COLUMN_WIDTH,
              render: renderCalendar,
            },
            {
              title: "Provider",
              key: "provider",
              width: PROVIDER_COLUMN_WIDTH,
              render: (_, row) => renderProvider(row.source),
            },
            {
              // No fixed width — this is the one column that should absorb
              // whatever space the fixed-width columns around it leave over.
              title: "Oldest pending",
              dataIndex: "oldestPendingAt",
              render: (value: string | null) =>
                value ? (
                  <Tooltip title={new Date(value).toLocaleString()}>{formatAge(value)}</Tooltip>
                ) : (
                  "—"
                ),
            },
            {
              title: "Sent",
              dataIndex: "sent",
              width: COUNT_COLUMN_WIDTH,
              align: "right",
              render: renderMonoNumber,
            },
            {
              title: "Pending",
              dataIndex: "pending",
              width: COUNT_COLUMN_WIDTH,
              align: "right",
              render: renderMonoNumber,
            },
            {
              title: "Failed",
              dataIndex: "failed",
              width: COUNT_COLUMN_WIDTH,
              align: "right",
              render: (value: number) =>
                value > 0 ? <Tag color="red">{renderMonoNumber(value)}</Tag> : renderMonoNumber(value),
            },
            {
              title: "",
              key: "actions",
              width: BACKFILL_COLUMN_WIDTH,
              align: "right",
              render: (_, row) =>
                row.calendarId ? (
                  <Popconfirm
                    title="Backfill this calendar?"
                    description="Re-queues every current event as a fresh publish — for standing up or catching up a downstream database."
                    onConfirm={() => handleBackfill(row.calendarId!, row.source)}
                  >
                    <Button size="small" type="primary">
                      Backfill
                    </Button>
                  </Popconfirm>
                ) : null,
            },
          ]}
        />
      </Card>

      {summary?.enabled && (
        <Card title="Failed" style={{ borderRadius: 0, borderTop: "none" }}>
          <Table<OutboxRecord>
            rowKey="id"
            loading={failedLoading}
            dataSource={failed}
            pagination={{ pageSize: 20 }}
            size="small"
            columns={[
              {
                title: "Calendar",
                dataIndex: "source",
                width: CALENDAR_COLUMN_WIDTH,
                render: renderCalendar,
              },
              {
                title: "Provider",
                key: "provider",
                width: PROVIDER_COLUMN_WIDTH,
                render: (_, row) => renderProvider(row.source),
              },
              { title: "Subject", dataIndex: "subject" },
              {
                title: "Last error",
                dataIndex: "lastError",
                render: (value: string | null) => (
                  <Typography.Text type="danger" ellipsis={{ tooltip: value }} style={{ maxWidth: 400 }}>
                    {value ?? "—"}
                  </Typography.Text>
                ),
              },
              {
                title: "Attempts",
                dataIndex: "attempts",
                width: ATTEMPTS_COLUMN_WIDTH,
                align: "right",
                render: renderMonoNumber,
              },
              {
                title: "",
                key: "actions",
                render: (_, row) => (
                  <Space>
                    <Button size="small" onClick={() => handleRequeue(row.id)}>
                      Requeue
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      )}
    </AppLayout>
  );
}
