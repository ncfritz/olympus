import { ExportOutlined, TagsOutlined } from "@ant-design/icons";
import type {
  ListMailAuditChangesResponse,
  MailAuditAction,
  MailAuditChange,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Flex,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

type Query = Filters & { label?: string; ready: boolean };
import mailApi, { type MailAuditChangeSort } from "../../../../api/mailApi";
import ChangeTag from "../../../../components/minerva/mail/audit/ChangeTag";
import MailBreadcrumbs from "../../../../components/minerva/mail/MailBreadcrumbs";
import { useFetch } from "../../../../hooks/useFetch";
import { gmailLink } from "../../../../utils/mailAudit";

const { Title, Text } = Typography;

const PAGE_SIZE = 50;

type Filters = {
  action?: MailAuditAction;
  minConfidence?: number;
  sortBy: MailAuditChangeSort;
  page: number;
};

const ACTIONS = [
  { label: "All changes", value: "all" },
  { label: "Adding", value: "add" },
  { label: "Removing", value: "remove" },
];

const CONFIDENCES = [
  { label: "Any confidence", value: 0 },
  { label: "≥ 80%", value: 0.8 },
  { label: "≥ 90%", value: 0.9 },
  { label: "≥ 95%", value: 0.95 },
];

/**
 * A label's review (docs/plans/email-management phase 2): the audit's
 * proposed changes into and out of one label, or all of them, with each
 * message's current labels and the evidence. Read-only until phase 4.
 */
const MailLabelReviewPage: React.FunctionComponent = () => {
  const router = useRouter();
  const label =
    typeof router.query.name === "string" ? router.query.name : undefined;
  const [filters, setFilters] = useState<Filters>({
    sortBy: "confidence",
    page: 0,
  });
  // Another label starts from its first page.
  useEffect(() => {
    setFilters((f) => (f.page === 0 ? f : { ...f, page: 0 }));
  }, [label]);

  // The label comes from the address, which is known only once the router
  // is ready: no request goes out before, so none goes out without it.
  const [result, loading] = useFetch<
    Query,
    ListMailAuditChangesResponse | undefined
  >({
    dataType: "proposed changes",
    params: { ...filters, label, ready: router.isReady },
    watch: [router.isReady, label, filters],
    validateOptions: (q) => q.ready,
    fetchFunction: async (f) =>
      (
        await mailApi.listAuditChanges({
          ...(f.label ? { label: f.label } : {}),
          ...(f.action ? { action: f.action } : {}),
          ...(f.minConfidence ? { minConfidence: f.minConfidence } : {}),
          sortBy: f.sortBy,
          pageSize: PAGE_SIZE,
          startPage: f.page,
        })
      ).data,
  });

  const title = label ?? "All proposed changes";

  return (
    <>
      <MailBreadcrumbs
        trail={[
          <Link
            key={"reclassification"}
            href={"/minerva/mail/reclassification"}
          >
            <Space size={4}>
              <TagsOutlined />
              <span>Re-classification</span>
            </Space>
          </Link>,
          <span key={"label"}>{title}</span>,
        ]}
      />
      <div
        style={{
          height: "calc(100vh - 92px)",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <Flex
          justify={"space-between"}
          align={"center"}
          wrap={true}
          gap={12}
          style={{ padding: 16 }}
        >
          <Space align={"baseline"} size={12}>
            <Title level={3} style={{ margin: 0 }}>
              {title}
            </Title>
            <Text type={"secondary"} style={{ fontSize: 15 }}>
              {result
                ? `${result.count.toLocaleString()} proposed changes`
                : ""}
            </Text>
          </Space>
          <Space size={12} wrap={true}>
            <Segmented
              options={ACTIONS}
              value={filters.action ?? "all"}
              onChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  action: v === "all" ? undefined : (v as MailAuditAction),
                  page: 0,
                }))
              }
            />
            <Select
              style={{ width: 150 }}
              options={CONFIDENCES}
              value={filters.minConfidence ?? 0}
              onChange={(v: number) =>
                setFilters((f) => ({
                  ...f,
                  minConfidence: v || undefined,
                  page: 0,
                }))
              }
            />
            <Segmented
              options={[
                { label: "Most confident", value: "confidence" },
                { label: "Newest", value: "receivedTime" },
              ]}
              value={filters.sortBy}
              onChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  sortBy: v as MailAuditChangeSort,
                  page: 0,
                }))
              }
            />
          </Space>
        </Flex>
        <div style={{ padding: "0 16px 16px" }}>
          <Table<MailAuditChange>
            size={"small"}
            loading={loading}
            dataSource={result?.changes ?? []}
            rowKey={(c) =>
              `${c.message.gmailId}\u0000${c.label}\u0000${c.action}`
            }
            pagination={{
              current: filters.page + 1,
              pageSize: PAGE_SIZE,
              total: result?.count ?? 0,
              showSizeChanger: false,
              onChange: (p) => setFilters((f) => ({ ...f, page: p - 1 })),
            }}
            columns={[
              {
                title: "Received",
                key: "received",
                width: 110,
                render: (_, c) =>
                  DateTime.fromISO(c.message.receivedTime).toLocaleString(
                    DateTime.DATE_MED,
                  ),
              },
              {
                title: "From",
                key: "from",
                width: 180,
                ellipsis: true,
                render: (_, c) => (
                  <Tooltip title={c.message.fromAddress}>
                    {c.message.fromName ?? c.message.fromAddress ?? "–"}
                  </Tooltip>
                ),
              },
              {
                title: "Subject",
                key: "subject",
                ellipsis: true,
                render: (_, c) => (
                  <a
                    href={gmailLink(c.message.gmailId)}
                    target={"_blank"}
                    rel={"noreferrer"}
                  >
                    {c.message.subject ?? "(no subject)"} <ExportOutlined />
                  </a>
                ),
              },
              {
                title: "Labels now",
                key: "labels",
                width: 220,
                render: (_, c) =>
                  c.message.labels.length ? (
                    c.message.labels.map((l) => <Tag key={l}>{l}</Tag>)
                  ) : (
                    <Text type={"secondary"}>none</Text>
                  ),
              },
              {
                title: "Proposed",
                key: "proposed",
                width: 260,
                render: (_, c) => (
                  <Tooltip
                    title={`${c.senderLabelMessages} of this sender's ${c.senderMessages} received messages carry ${c.label}`}
                  >
                    <span>
                      <ChangeTag
                        action={c.action}
                        label={c.label}
                        confidence={c.confidence}
                      />
                    </span>
                  </Tooltip>
                ),
              },
            ]}
          />
        </div>
      </div>
    </>
  );
};

export default MailLabelReviewPage;
