"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Flex,
  Table,
  Tag,
  Typography,
  type TableProps,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import useSWR from "swr";
import {
  fetchCalendars,
  fetchSyncRun,
  fetchSyncRuns,
  type SyncRun,
  type SyncRunEventChange,
  type SyncRunFilterParams,
} from "@/lib/api/queries";
import { PROVIDER_META, ProviderIcon, type Provider } from "@/lib/providerMeta";
import { useCalendarColors } from "@/lib/useCalendarColors";
import { AppLayout } from "./AppLayout";
import { SyncStatsCharts } from "./SyncStatsCharts";

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  success: { color: "green", label: "Success" },
  error: { color: "red", label: "Error" },
};

const TYPE_LABEL: Record<string, string> = { full: "Full", incremental: "Incremental" };
const TRIGGER_LABEL: Record<string, string> = { manual: "Manual", poll: "Poll", webhook: "Push" };
const ACTION_TAG: Record<string, string> = { added: "green", updated: "blue", deleted: "red" };

/** Column header filter options (antd's {text, value} shape) for the Type/Trigger/Status columns. */
const TYPE_FILTERS = [
  { text: "Full", value: "full" },
  { text: "Incremental", value: "incremental" },
];
const TRIGGER_FILTERS = [
  { text: "Manual", value: "manual" },
  { text: "Poll", value: "poll" },
  { text: "Push", value: "webhook" },
];
const STATUS_FILTERS = [
  { text: "Success", value: "success" },
  { text: "Error", value: "error" },
];

const HISTORY_LIMIT = 200;

/** The filter keys this page reads/writes as URL search params — also each filterable column's `key`, so Table's onChange filters object is keyed the same way. */
type FilterKey = "calendarId" | "type" | "trigger" | "status";

const SOURCE_SWATCH_SIZE = 16;
const CALENDAR_COLUMN_WIDTH = 400;
const PROVIDER_COLUMN_WIDTH = 160;
const STARTED_COLUMN_WIDTH = 180;
const TYPE_COLUMN_WIDTH = 110;
const TRIGGER_COLUMN_WIDTH = 100;
const STATUS_COLUMN_WIDTH = 100;
const COUNT_COLUMN_WIDTH = 80;

function formatDuration(startedAt: string, finishedAt: string): string {
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Right-aligned numeric columns (Total/Added/Updated/Deleted) render their value in monospace. */
function renderMonoNumber(value: number) {
  return <span style={{ fontFamily: "monospace" }}>{value}</span>;
}

export function SyncHistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarId = searchParams.get("calendarId") ?? undefined;
  const type = (searchParams.get("type") ?? undefined) as SyncRun["type"] | undefined;
  const trigger = (searchParams.get("trigger") ?? undefined) as SyncRun["trigger"] | undefined;
  const status = (searchParams.get("status") ?? undefined) as SyncRun["status"] | undefined;
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: calendars = [] } = useSWR("/calendars", fetchCalendars);
  const { colorForSource } = useCalendarColors();
  const providerBySource = useMemo(
    () => new Map(calendars.map((c) => [c.source, c.provider as Provider])),
    [calendars],
  );
  const {
    data: runs = [],
    isLoading,
    mutate,
  } = useSWR(["/sync-runs", calendarId, type, trigger, status], () =>
    fetchSyncRuns({ calendarId, type, trigger, status, limit: HISTORY_LIMIT }),
  );

  const calendarFilters = useMemo(
    () => calendars.map((c) => ({ text: c.source, value: c.calendarId })),
    [calendars],
  );

  const filter: SyncRunFilterParams = { calendarId, type, trigger, status };

  const handleTableChange: NonNullable<TableProps<SyncRun>["onChange"]> = (_pagination, filters) => {
    const params = new URLSearchParams(searchParams.toString());
    const applyFilter = (key: FilterKey) => {
      const value = filters[key]?.[0];
      if (value !== undefined && value !== null) params.set(key, String(value));
      else params.delete(key);
    };
    applyFilter("calendarId");
    applyFilter("type");
    applyFilter("trigger");
    applyFilter("status");
    router.replace(params.toString() ? `/sync?${params}` : "/sync");
  };

  return (
    <AppLayout>
      <SyncStatsCharts filter={filter} />
      <Card
        title="Sync History"
        style={{ borderRadius: 0 }}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => mutate()} loading={isLoading} aria-label="Refresh" />
        }
      >
        <Table<SyncRun>
          rowKey="id"
          loading={isLoading}
          dataSource={runs}
          pagination={{ pageSize: 20 }}
          size="small"
          onChange={handleTableChange}
          onRow={(run) => ({
            onClick: () => setSelectedRunId(run.id),
            style: { cursor: "pointer" },
          })}
          columns={[
            {
              title: "Calendar",
              dataIndex: "source",
              key: "calendarId",
              width: CALENDAR_COLUMN_WIDTH,
              filters: calendarFilters,
              filteredValue: calendarId ? [calendarId] : null,
              filterMultiple: false,
              render: (value: string) => (
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
              ),
            },
            {
              title: "Provider",
              key: "provider",
              width: PROVIDER_COLUMN_WIDTH,
              render: (_, run) => {
                const provider = providerBySource.get(run.source);
                if (!provider) return "—";
                return (
                  <Flex align="center" gap={8}>
                    <ProviderIcon provider={provider} size={16} />
                    <span>{PROVIDER_META[provider].label}</span>
                  </Flex>
                );
              },
            },
            {
              title: "Started",
              dataIndex: "startedAt",
              width: STARTED_COLUMN_WIDTH,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: "Type",
              dataIndex: "type",
              key: "type",
              width: TYPE_COLUMN_WIDTH,
              filters: TYPE_FILTERS,
              filteredValue: type ? [type] : null,
              filterMultiple: false,
              render: (value: string) => TYPE_LABEL[value] ?? value,
            },
            {
              title: "Trigger",
              dataIndex: "trigger",
              key: "trigger",
              width: TRIGGER_COLUMN_WIDTH,
              filters: TRIGGER_FILTERS,
              filteredValue: trigger ? [trigger] : null,
              filterMultiple: false,
              render: (value: string) => TRIGGER_LABEL[value] ?? value,
            },
            {
              title: "Status",
              dataIndex: "status",
              key: "status",
              width: STATUS_COLUMN_WIDTH,
              filters: STATUS_FILTERS,
              filteredValue: status ? [status] : null,
              filterMultiple: false,
              render: (value: string) => {
                const tag = STATUS_TAG[value] ?? { color: "default", label: value };
                return <Tag color={tag.color}>{tag.label}</Tag>;
              },
            },
            {
              // No fixed width — this is the one column that should absorb
              // whatever space the fixed-width columns around it leave over.
              title: "Duration",
              key: "duration",
              render: (_, run) => (
                <span style={{ fontFamily: "monospace" }}>{formatDuration(run.startedAt, run.finishedAt)}</span>
              ),
            },
            {
              title: "Total",
              dataIndex: "totalCount",
              width: COUNT_COLUMN_WIDTH,
              align: "right",
              render: renderMonoNumber,
            },
            {
              title: "Added",
              dataIndex: "addedCount",
              width: COUNT_COLUMN_WIDTH,
              align: "right",
              render: renderMonoNumber,
            },
            {
              title: "Updated",
              dataIndex: "updatedCount",
              width: COUNT_COLUMN_WIDTH,
              align: "right",
              render: renderMonoNumber,
            },
            {
              title: "Deleted",
              dataIndex: "deletedCount",
              width: COUNT_COLUMN_WIDTH,
              align: "right",
              render: renderMonoNumber,
            },
          ]}
        />
      </Card>
      <SyncRunDetailDrawer runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
    </AppLayout>
  );
}

function SyncRunDetailDrawer({
  runId,
  onClose,
}: {
  runId: string | null;
  onClose: () => void;
}) {
  const { data: run, isLoading } = useSWR(
    runId ? ["/sync-runs", runId] : null,
    ([, id]) => fetchSyncRun(id),
  );

  return (
    <Drawer title="Sync run details" open={runId !== null} onClose={onClose} size="large">
      {!isLoading && run && (
        <>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Calendar">{run.source}</Descriptions.Item>
            <Descriptions.Item label="Type">{TYPE_LABEL[run.type] ?? run.type}</Descriptions.Item>
            <Descriptions.Item label="Trigger">{TRIGGER_LABEL[run.trigger] ?? run.trigger}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={(STATUS_TAG[run.status] ?? { color: "default" }).color}>
                {(STATUS_TAG[run.status] ?? { label: run.status }).label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Started">{new Date(run.startedAt).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Finished">{new Date(run.finishedAt).toLocaleString()}</Descriptions.Item>
            {run.errorMessage && (
              <Descriptions.Item label="Error" span={2}>
                <Typography.Text type="danger">{run.errorMessage}</Typography.Text>
              </Descriptions.Item>
            )}
          </Descriptions>
          <Typography.Title level={5} style={{ marginTop: 24 }}>
            Changes ({run.changes.length})
          </Typography.Title>
          <Table<SyncRunEventChange>
            rowKey="eventId"
            dataSource={run.changes}
            pagination={{ pageSize: 10 }}
            size="small"
            columns={[
              {
                title: "Action",
                dataIndex: "action",
                width: 100,
                render: (value: string) => <Tag color={ACTION_TAG[value] ?? "default"}>{value}</Tag>,
              },
              { title: "Subject", dataIndex: "subject" },
              {
                title: "Start time",
                dataIndex: "startTime",
                render: (value: string | null) => (value ? new Date(value).toLocaleString() : "—"),
              },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}
