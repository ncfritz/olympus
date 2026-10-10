"use client";

import { Flex, Table, Tag, Typography } from "antd";
import { useAuditEvents } from "@/lib/api/queries";
import type { AuditEvent } from "@/lib/api/types";
import { formatDateTime } from "@/lib/labels";
import { ErrorAlert } from "./ErrorAlert";

/** The audit log (ADR 0020): who did what to which CA, key or certificate. */
export function AuditPage() {
  const { data: events, error, isLoading } = useAuditEvents();
  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={3}>Audit</Typography.Title>
        <Typography.Text type="secondary">
          The most recent events, newest first. Each is chained to the one
          before it, so a gap or an edit shows.
        </Typography.Text>
      </div>
      <ErrorAlert error={error} />
      <Table<AuditEvent>
        rowKey="sequence"
        size="small"
        loading={isLoading}
        dataSource={events ?? []}
        pagination={{ pageSize: 50, hideOnSinglePage: true }}
        expandable={{
          rowExpandable: (event) => event.attributes.length > 0,
          expandedRowRender: (event) => (
            <Flex gap={4} wrap>
              {event.attributes.map((attribute) => (
                <Tag key={attribute.name}>
                  {attribute.name}: {attribute.value}
                </Tag>
              ))}
            </Flex>
          ),
        }}
        columns={[
          { title: "#", dataIndex: "sequence" },
          { title: "When", dataIndex: "occurredAt", render: formatDateTime },
          {
            title: "What",
            dataIndex: "kind",
            render: (kind: string) => <Tag>{kind}</Tag>,
          },
          { title: "Who", dataIndex: "principal" },
          {
            title: "Subject",
            key: "subject",
            render: (_, event) =>
              event.subjectId
                ? `${event.subjectType}: ${event.subjectId}`
                : "—",
          },
          {
            title: "Reason",
            dataIndex: "reason",
            render: (r?: string) => r ?? "",
          },
        ]}
      />
    </Flex>
  );
}
