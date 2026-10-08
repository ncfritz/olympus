import { ExportOutlined } from "@ant-design/icons";
import type {
  ListMailThreadMessagesResponse,
  MailAuditThread,
  MailThreadMessage,
} from "@ncfritz/olympus-sdk/minerva";
import { Flex, Table, Tag, Typography } from "antd";
import React, { useState } from "react";
import mailApi from "../../../../api/mailApi";
import { useFetch } from "../../../../hooks/useFetch";
import { gmailLink } from "../../../../utils/mailAudit";
import {
  CaretExpandIcon,
  Mono,
  ReceivedCell,
  SenderCell,
  SubjectCell,
} from "../MailCells";

const { Text } = Typography;

/** The expand column; the sub-table starts after it, under Thread. */
const EXPAND_COLUMN = 48;
/** A thread's messages a page. */
const MESSAGES_PAGE = 10;

const key = (t: { accountId: string; threadId: string }) =>
  `${t.accountId}/${t.threadId}`;

/** Labels as small gold tags, or none in grey. */
const LabelTags: React.FunctionComponent<{ labels: string[] }> = ({
  labels,
}) =>
  labels.length ? (
    <Flex gap={4} wrap={true}>
      {labels.map((l) => (
        <Tag key={l} color={"gold"} style={{ marginInlineEnd: 0 }}>
          {l}
        </Tag>
      ))}
    </Flex>
  ) : (
    <Text type={"secondary"} style={{ fontSize: 12 }}>
      no labels
    </Text>
  );

/** A thread's messages, oldest first, a page at a time. */
const ThreadMessages: React.FunctionComponent<{ thread: MailAuditThread }> = ({
  thread,
}) => {
  const [page, setPage] = useState(0);
  const [found, loading] = useFetch<
    { page: number },
    ListMailThreadMessagesResponse | undefined
  >({
    dataType: "thread's messages",
    params: { page },
    watch: [page],
    fetchFunction: async (p) =>
      (
        await mailApi.listThreadMessages(thread.accountId, thread.threadId, {
          pageSize: MESSAGES_PAGE,
          startPage: p.page,
        })
      ).data,
  });
  return (
    // AntD sets a nested table in 40px, and the cell's 8px padding makes
    // 48, the expand column's width: it starts under Thread.
    <div>
      <Table<MailThreadMessage>
        size={"small"}
        rowKey={"gmailId"}
        loading={loading}
        dataSource={found?.messages ?? []}
        tableLayout={"fixed"}
        pagination={{
          current: page + 1,
          pageSize: MESSAGES_PAGE,
          total: found?.count ?? 0,
          hideOnSinglePage: true,
          showSizeChanger: false,
          size: "small",
          onChange: (p) => setPage(p - 1),
        }}
        columns={[
          {
            title: "From",
            key: "from",
            width: 220,
            render: (_, m) => (
              <SenderCell name={m.fromName} address={m.fromAddress} />
            ),
          },
          {
            title: "Received",
            key: "received",
            width: 104,
            render: (_, m) => <ReceivedCell time={String(m.receivedTime)} />,
          },
          {
            title: "Subject",
            key: "subject",
            ellipsis: true,
            render: (_, m) => (
              <a
                href={gmailLink(m.gmailId)}
                target={"_blank"}
                rel={"noreferrer"}
              >
                <SubjectCell subject={m.subject} />
              </a>
            ),
          },
          {
            title: "Labels",
            key: "labels",
            width: 320,
            render: (_, m) => <LabelTags labels={m.labels} />,
          },
        ]}
      />
    </div>
  );
};

/**
 * Threads whose messages carry different labels, largest first: each
 * with its sets of labels, and its messages a page at a time when it is
 * opened.
 */
const MixedThreads: React.FunctionComponent<{ threads: MailAuditThread[] }> = ({
  threads,
}) => (
  <Flex vertical={true} gap={8}>
    <Text type={"secondary"}>The largest 50.</Text>
    <Table<MailAuditThread>
      size={"small"}
      rowKey={key}
      dataSource={threads}
      tableLayout={"fixed"}
      pagination={{ pageSize: 10, hideOnSinglePage: true, size: "small" }}
      locale={{ emptyText: "Every thread's messages agree." }}
      expandable={{
        columnWidth: EXPAND_COLUMN,
        expandIcon: (p) => (
          <CaretExpandIcon {...p} label={`thread ${p.record.threadId}`} />
        ),
        expandedRowRender: (t) => <ThreadMessages thread={t} />,
      }}
      columns={[
        {
          title: "Thread",
          dataIndex: "threadId",
          width: 220,
          sorter: (a, b) => a.threadId.localeCompare(b.threadId),
          render: (id: string) => (
            <a href={gmailLink(id)} target={"_blank"} rel={"noreferrer"}>
              <Text code={true}>{id}</Text> <ExportOutlined />
            </a>
          ),
        },
        {
          title: "Messages",
          dataIndex: "messages",
          align: "right",
          width: 110,
          sorter: (a, b) => a.messages - b.messages,
          render: (n: number) => <Mono>{n.toLocaleString()}</Mono>,
        },
        {
          title: "Label sets",
          key: "sets",
          render: (_, t) => (
            <Flex vertical={true} gap={4}>
              {t.sets.map((s) => (
                <Flex key={s.labels.join("\u0000")} gap={8} align={"center"}>
                  <Mono style={{ width: 40, flex: "none", textAlign: "right" }}>
                    {s.messages.toLocaleString()}×
                  </Mono>
                  <LabelTags labels={s.labels} />
                </Flex>
              ))}
            </Flex>
          ),
        },
        {
          title: "Last mail",
          dataIndex: "lastReceivedTime",
          width: 110,
          sorter: (a, b) =>
            String(a.lastReceivedTime).localeCompare(
              String(b.lastReceivedTime),
            ),
          render: (t: string) => <ReceivedCell time={String(t)} />,
        },
      ]}
    />
  </Flex>
);

export default MixedThreads;
