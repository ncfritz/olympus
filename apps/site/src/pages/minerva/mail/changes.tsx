import {
  HistoryOutlined,
  MergeOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import type {
  MailAccount,
  MailChangeBatch,
  MailChangeBatchStatus,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Empty,
  Flex,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import mailApi from "../../../api/mailApi";
import BatchChangesTable from "../../../components/minerva/mail/BatchChangesTable";
import MailBreadcrumbs from "../../../components/minerva/mail/MailBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { apiProblems } from "../../../utils/goals";
import { batchSummary, canUndo } from "../../../utils/mailChanges";

const { Title, Text } = Typography;

/** While a batch is being written, the log looks again this often. */
const REFRESH_MS = 4000;

const STATUS: Record<MailChangeBatchStatus, { color?: string; text: string }> =
  {
    pending: { color: "blue", text: "Waiting" },
    running: { color: "processing", text: "Writing" },
    done: { color: "green", text: "Done" },
    failed: { color: "red", text: "Failed" },
  };

/**
 * The change log (docs/plans/email-management phase 4; ADR 0030): every
 * batch of label changes written to Gmail from Olympus, newest first, what
 * became of each message, and undo for an apply that wrote something.
 */
const MailChangeLogPage: React.FunctionComponent = () => {
  const [accountId, setAccountId] = useState<string>();
  const [accounts] = useFetch<Record<string, never>, MailAccount[]>({
    dataType: "mail accounts",
    params: {},
    watch: [],
    default: [],
    fetchFunction: async () => (await mailApi.listAccounts()).data.accounts,
  });
  useEffect(() => {
    if (!accountId && accounts.length) {
      setAccountId((accounts.find((a) => a.linkedTime) ?? accounts[0]).id);
    }
  }, [accounts, accountId]);

  const [batches, loading, , refetch] = useFetch<
    { accountId?: string },
    MailChangeBatch[]
  >({
    dataType: "change log",
    params: { accountId },
    watch: [accountId],
    default: [],
    validateOptions: (q) => Boolean(q.accountId),
    fetchFunction: async (q) =>
      (await mailApi.listChangeBatches(q.accountId as string)).data.batches,
  });

  // Follow batches still being written.
  const busy = batches.some(
    (b) => b.status === "pending" || b.status === "running",
  );
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => void refetch(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [busy, accountId]);

  const undo = async (batch: MailChangeBatch) => {
    try {
      await mailApi.undoChangeBatch(batch.id);
      message.success("Undoing the batch in Gmail");
      await refetch(true);
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    }
  };

  const undoneBy = new Map(
    batches.filter((b) => b.undoesBatchId).map((b) => [b.undoesBatchId, b]),
  );

  return (
    <>
      <MailBreadcrumbs
        trail={[
          <Space key={"page"} size={4}>
            <HistoryOutlined />
            <span>Change log</span>
          </Space>,
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
              Change log
            </Title>
            <Text type={"secondary"} style={{ fontSize: 15 }}>
              Label changes written to Gmail from Olympus
            </Text>
          </Space>
          {accounts.length > 1 && (
            <Select
              style={{ width: 280 }}
              value={accountId}
              onChange={setAccountId}
              options={accounts.map((a) => ({ value: a.id, label: a.email }))}
            />
          )}
        </Flex>
        <div style={{ padding: "0 16px 16px" }}>
          <Table<MailChangeBatch>
            size={"small"}
            loading={loading}
            dataSource={batches}
            rowKey={(b) => b.id}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  description={
                    "Nothing written to Gmail yet. Apply proposed changes from Re-classification."
                  }
                />
              ),
            }}
            expandable={{
              expandedRowRender: (b) => (
                <Space direction={"vertical"} style={{ width: "100%" }}>
                  {b.labelOps.length > 0 && (
                    <Space size={[6, 6]} wrap={true}>
                      {b.labelOps.map((o) => (
                        <Tooltip key={`${o.op}:${o.name}`} title={o.detail}>
                          <Tag
                            color={
                              o.status === "done"
                                ? "green"
                                : o.status === "failed"
                                  ? "red"
                                  : undefined
                            }
                          >
                            {o.op === "rename"
                              ? `Rename ${o.name} → ${o.newName}`
                              : o.op === "create"
                                ? `Create ${o.name}`
                                : `Delete ${o.name}`}
                            {o.status === "done" ? "" : ` (${o.status})`}
                          </Tag>
                        </Tooltip>
                      ))}
                    </Space>
                  )}
                  {b.messages > 0 && (
                    <BatchChangesTable batchId={b.id} total={b.messages} />
                  )}
                </Space>
              ),
            }}
            columns={[
              {
                title: "Asked for",
                key: "requested",
                width: 170,
                render: (_, b) =>
                  DateTime.fromISO(b.requestedTime).toLocaleString(
                    DateTime.DATETIME_MED,
                  ),
              },
              {
                title: "Batch",
                key: "kind",
                width: 160,
                render: (_, b) =>
                  b.kind === "undo" ? (
                    <Space size={4}>
                      <UndoOutlined />
                      <span>Undo</span>
                    </Space>
                  ) : b.kind === "merge" ? (
                    <Space size={4}>
                      <MergeOutlined />
                      <span>Merge</span>
                    </Space>
                  ) : (
                    "Apply"
                  ),
              },
              {
                title: "Messages",
                key: "messages",
                width: 100,
                align: "right",
                render: (_, b) => b.messages.toLocaleString(),
              },
              {
                title: "Status",
                key: "status",
                width: 120,
                render: (_, b) => (
                  <Tooltip title={b.error}>
                    <Tag color={STATUS[b.status].color}>
                      {STATUS[b.status].text}
                    </Tag>
                  </Tooltip>
                ),
              },
              {
                title: "Outcome",
                key: "outcome",
                render: (_, b) => (
                  <Space size={8} wrap={true}>
                    <Text>{batchSummary(b)}</Text>
                    {b.undoneByBatchId && (
                      <Tag>
                        Undone
                        {undoneBy.get(b.id)
                          ? ` ${DateTime.fromISO(
                              (undoneBy.get(b.id) as MailChangeBatch)
                                .requestedTime,
                            ).toLocaleString(DateTime.DATETIME_SHORT)}`
                          : ""}
                      </Tag>
                    )}
                  </Space>
                ),
              },
              {
                title: "",
                key: "actions",
                width: 110,
                render: (_, b) =>
                  canUndo(b) ? (
                    <Popconfirm
                      title={"Undo this batch?"}
                      description={
                        "Puts back the labels it changed, on messages still as it left them (one changed in Gmail since is left as it is), and reverses its renames, deletes and creates."
                      }
                      okText={"Undo"}
                      onConfirm={() => undo(b)}
                    >
                      <Button size={"small"} icon={<UndoOutlined />}>
                        Undo
                      </Button>
                    </Popconfirm>
                  ) : null,
              },
            ]}
          />
        </div>
      </div>
    </>
  );
};

export default MailChangeLogPage;
