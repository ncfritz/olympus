import { ExportOutlined } from "@ant-design/icons";
import type {
  DescribeMailChangeBatchResponse,
  MailChange,
  MailChangeStatus,
} from "@ncfritz/olympus-sdk/minerva";
import { Table, Tag, Typography } from "antd";
import React, { useState } from "react";
import mailApi from "../../../api/mailApi";
import { useFetch } from "../../../hooks/useFetch";
import { gmailLink } from "../../../utils/mailAudit";
import { flagChangeText } from "../../../utils/mailInbox";
import ChangeTag from "./audit/ChangeTag";

const { Text } = Typography;

const PAGE_SIZE = 100;

const STATUS: Record<MailChangeStatus, { color?: string; text: string }> = {
  pending: { text: "To write" },
  written: { color: "green", text: "Written" },
  unchanged: { text: "Already so" },
  changed: { color: "gold", text: "Changed in Gmail" },
  gone: { text: "Gone" },
  failed: { color: "red", text: "Failed" },
};

/**
 * A batch's changes in the change log (docs/plans/email-management phase
 * 4): each message's labels before, what the batch added and removed, and
 * what became of it.
 */
const BatchChangesTable: React.FunctionComponent<{
  batchId: string;
  /** Changes the batch has, for paging. */
  total: number;
}> = ({ batchId, total }) => {
  const [page, setPage] = useState(0);
  const [result, loading] = useFetch<
    { batchId: string; page: number },
    DescribeMailChangeBatchResponse | undefined
  >({
    dataType: "batch changes",
    params: { batchId, page },
    watch: [batchId, page],
    fetchFunction: async (q) =>
      (
        await mailApi.describeChangeBatch(
          q.batchId,
          q.page * PAGE_SIZE,
          PAGE_SIZE,
        )
      ).data,
  });

  return (
    <Table<MailChange>
      size={"small"}
      loading={loading}
      dataSource={result?.changes ?? []}
      rowKey={(c) => c.gmailId}
      pagination={{
        current: page + 1,
        pageSize: PAGE_SIZE,
        total,
        showSizeChanger: false,
        hideOnSinglePage: true,
        onChange: (p) => setPage(p - 1),
      }}
      columns={[
        {
          title: "Message",
          key: "message",
          ellipsis: true,
          render: (_, c) => (
            <a href={gmailLink(c.gmailId)} target={"_blank"} rel={"noreferrer"}>
              {c.subject ?? (c.fromAddress ? "(no subject)" : c.gmailId)}{" "}
              <ExportOutlined />
            </a>
          ),
        },
        {
          title: "From",
          key: "from",
          width: 200,
          ellipsis: true,
          render: (_, c) => c.fromAddress ?? "–",
        },
        {
          title: "Labels before",
          key: "had",
          width: 240,
          render: (_, c) =>
            c.had.length ? (
              c.had.map((l) => <Tag key={l}>{l}</Tag>)
            ) : (
              <Text type={"secondary"}>none</Text>
            ),
        },
        {
          title: "Change",
          key: "change",
          width: 260,
          render: (_, c) => (
            <>
              {c.add.map((l) =>
                flagChangeText("add", l) ? (
                  <Tag key={`+${l}`}>{flagChangeText("add", l)}</Tag>
                ) : (
                  <ChangeTag key={`+${l}`} action={"add"} label={l} />
                ),
              )}
              {c.remove.map((l) =>
                flagChangeText("remove", l) ? (
                  <Tag key={`-${l}`}>{flagChangeText("remove", l)}</Tag>
                ) : (
                  <ChangeTag key={`-${l}`} action={"remove"} label={l} />
                ),
              )}
            </>
          ),
        },
        {
          title: "Outcome",
          key: "status",
          width: 150,
          render: (_, c) => (
            <Tag color={STATUS[c.status].color}>{STATUS[c.status].text}</Tag>
          ),
        },
      ]}
    />
  );
};

export default BatchChangesTable;
