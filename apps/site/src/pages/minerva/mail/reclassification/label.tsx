import {
  CheckOutlined,
  CloudUploadOutlined,
  ExportOutlined,
  HistoryOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import type {
  ListMailAuditChangesResponse,
  MailAuditAction,
  MailAuditChange,
  MailAuditRule,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  Button,
  Flex,
  message,
  Popconfirm,
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

import mailApi, { type MailAuditChangeSort } from "../../../../api/mailApi";
import ChangeTag from "../../../../components/minerva/mail/audit/ChangeTag";
import ExportButton from "../../../../components/minerva/mail/audit/ExportButton";
import MailBreadcrumbs from "../../../../components/minerva/mail/MailBreadcrumbs";
import { useFetch } from "../../../../hooks/useFetch";
import { apiProblems } from "../../../../utils/goals";
import { gmailLink } from "../../../../utils/mailAudit";
import {
  changesByAccount,
  proposalKey,
  proposalsByAccount,
} from "../../../../utils/mailChanges";

const { Title, Text } = Typography;

const PAGE_SIZE = 50;

type Query = Filters & { label?: string; ready: boolean };

type Filters = {
  action?: MailAuditAction;
  rule?: MailAuditRule;
  minConfidence?: number;
  sortBy: MailAuditChangeSort;
  page: number;
};

const ACTIONS = [
  { label: "All changes", value: "all" },
  { label: "Adding", value: "add" },
  { label: "Removing", value: "remove" },
];

const RULES = [
  { label: "Every source", value: "all" },
  { label: "Sender audit", value: "sender" },
  { label: "Classifier", value: "classifier" },
];

/** Why a change was proposed, for its tooltip. */
const evidence = (c: MailAuditChange): string =>
  c.rule === "classifier"
    ? `The classifier, scoring this message with a model that never saw it, is ${Math.round(c.confidence * 100)}% sure${c.ticked ? "" : "; below the label's threshold, so unticked"}`
    : `${c.senderLabelMessages} of this sender's ${c.senderMessages} received messages carry ${c.label}`;

const CONFIDENCES = [
  { label: "Any confidence", value: 0 },
  { label: "≥ 80%", value: 0.8 },
  { label: "≥ 90%", value: 0.9 },
  { label: "≥ 95%", value: 0.95 },
];

/**
 * A label's review (docs/plans/email-management phases 2 and 4): the
 * changes proposed into and out of one label, or all of them, by the
 * sender audit and the classifier, with each message's current labels and
 * the evidence. Selected proposals are applied to Gmail as a batch (phase
 * 4), followed in the change log, or marked processed without change.
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
  const [selected, setSelected] = useState<MailAuditChange[]>([]);
  const [busy, setBusy] = useState(false);
  // A new page or filter starts with nothing selected.
  useEffect(() => setSelected([]), [label, filters]);

  const [result, loading, , refetch] = useFetch<
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
          ...(f.rule ? { rule: f.rule } : {}),
          ...(f.minConfidence ? { minConfidence: f.minConfidence } : {}),
          sortBy: f.sortBy,
          pageSize: PAGE_SIZE,
          startPage: f.page,
        })
      ).data,
  });

  const title = label ?? "All proposed changes";

  const apply = async () => {
    const byAccount = changesByAccount(selected);
    setBusy(true);
    try {
      let messages = 0;
      for (const [accountId, changes] of byAccount) {
        const batch = (await mailApi.applyChanges(accountId, changes)).data
          .batch;
        messages += batch.messages;
      }
      message.success(
        <span>
          Writing changes to {messages.toLocaleString()} messages in Gmail.{" "}
          <Link href={"/minerva/mail/changes"}>
            Follow it in the change log
          </Link>
        </span>,
      );
      setSelected([]);
      // The batch is written in the background; what it applied shows soon.
      setTimeout(() => void refetch(true), 5000);
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    setBusy(true);
    try {
      let dismissed = 0;
      for (const [accountId, proposals] of proposalsByAccount(selected)) {
        dismissed += (await mailApi.dismissProposals(accountId, proposals)).data
          .dismissed;
      }
      message.success(
        `${dismissed.toLocaleString()} marked processed, Gmail unchanged`,
      );
      setSelected([]);
      await refetch(true);
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(false);
    }
  };

  const messagesSelected = new Set(selected.map((c) => c.message.gmailId)).size;

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
            <Link href={"/minerva/mail/changes"}>
              <Button icon={<HistoryOutlined />}>Change log</Button>
            </Link>
            <ExportButton
              label={label}
              action={filters.action}
              rule={filters.rule}
              minConfidence={filters.minConfidence}
            />
            <Select
              style={{ width: 150 }}
              options={RULES}
              value={filters.rule ?? "all"}
              onChange={(v: string) =>
                setFilters((f) => ({
                  ...f,
                  rule: v === "all" ? undefined : (v as MailAuditRule),
                  page: 0,
                }))
              }
            />
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
          {selected.length > 0 && (
            <Alert
              type={"info"}
              style={{ marginBottom: 12 }}
              message={
                <Flex justify={"space-between"} align={"center"} wrap={true}>
                  <Text>
                    {selected.length.toLocaleString()} proposed changes on{" "}
                    {messagesSelected.toLocaleString()} messages selected
                  </Text>
                  <Space wrap={true}>
                    <Popconfirm
                      title={"Apply to Gmail?"}
                      description={`Changes labels on ${messagesSelected.toLocaleString()} messages in Gmail. A message changed in Gmail since is left as it is. It can be undone from the change log.`}
                      okText={"Apply"}
                      onConfirm={apply}
                    >
                      <Button
                        type={"primary"}
                        icon={<CloudUploadOutlined />}
                        loading={busy}
                      >
                        Apply to Gmail
                      </Button>
                    </Popconfirm>
                    <Button
                      icon={<CheckOutlined />}
                      loading={busy}
                      onClick={dismiss}
                    >
                      Mark processed, no change
                    </Button>
                    <Button type={"text"} onClick={() => setSelected([])}>
                      Clear
                    </Button>
                  </Space>
                </Flex>
              }
            />
          )}
          <Table<MailAuditChange>
            size={"small"}
            loading={loading}
            dataSource={result?.changes ?? []}
            rowKey={proposalKey}
            rowSelection={{
              selectedRowKeys: selected.map(proposalKey),
              onChange: (_, rows) => setSelected(rows),
              getCheckboxProps: (c) => ({ disabled: Boolean(c.decision) }),
            }}
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
                  <Tooltip title={evidence(c)}>
                    <span>
                      <ChangeTag
                        action={c.action}
                        label={c.label}
                        confidence={c.confidence}
                        unticked={c.ticked === false}
                      />
                    </span>
                  </Tooltip>
                ),
              },
              {
                title: "Status",
                key: "status",
                width: 110,
                render: (_, c) =>
                  c.decision === "applied" ? (
                    <Tag color={"green"}>Applied</Tag>
                  ) : c.decision === "dismissed" ? (
                    <Tag>Processed</Tag>
                  ) : (
                    <Text type={"secondary"}>To review</Text>
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
