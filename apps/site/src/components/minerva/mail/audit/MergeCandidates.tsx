import { ArrowRightOutlined, MergeOutlined } from "@ant-design/icons";
import type { MailAuditMerge } from "@ncfritz/olympus-sdk/minerva";
import { Button, Flex, Table, Tag, Typography } from "antd";
import { DateTime } from "luxon";
import React, { useState } from "react";
import { percent } from "../../../../utils/mailAudit";
import MergeLabelsDialog from "../MergeLabelsDialog";
import { Mono } from "../MailCells";
import tableStyles from "../MailTable.module.css";

const { Text } = Typography;

const lastMail = (time?: string) =>
  time ? DateTime.fromISO(time).toFormat("LLL yyyy") : "never";

/** A last-mail cell: the month, or never in grey. */
const LastMail: React.FunctionComponent<{ time?: string }> = ({ time }) => (
  <Text type={time ? undefined : "secondary"} style={{ fontSize: 12 }}>
    {lastMail(time)}
  </Text>
);

/**
 * Labels the audit proposes as one, a row each: from → into, why, the
 * senders they share, the mail that would move and each one's last mail,
 * and Preview merge, which opens the merge dialog on the pair (phase 4).
 * Any two labels can be merged from Merge labels.
 */
const MergeCandidates: React.FunctionComponent<{
  merges: MailAuditMerge[];
  /** Every user label, for the dialog's choices. */
  labels: string[];
}> = ({ merges, labels }) => {
  const [pair, setPair] = useState<{ from?: string; into?: string }>();
  return (
    <div className={tableStyles.column}>
      <Flex justify={"flex-end"}>
        <Button
          size={"small"}
          icon={<MergeOutlined />}
          onClick={() => setPair({})}
        >
          Merge labels…
        </Button>
      </Flex>
      <div className={tableStyles.fill}>
        <Table<MailAuditMerge>
          size={"small"}
          rowKey={(m) => `${m.fromLabel}\u0000${m.intoLabel}`}
          dataSource={merges}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          scroll={{ y: 1 }}
          tableLayout={"fixed"}
          locale={{ emptyText: "No labels look like one." }}
          columns={[
            {
              title: "Merge",
              key: "pair",
              sorter: (a, b) => a.fromLabel.localeCompare(b.fromLabel),
              render: (_, m) => (
                <Flex align={"center"} gap={6} wrap={true}>
                  <Tag style={{ marginInlineEnd: 0 }}>{m.fromLabel}</Tag>
                  <ArrowRightOutlined style={{ fontSize: 11 }} />
                  <Tag color={"green"} style={{ marginInlineEnd: 0 }}>
                    {m.intoLabel}
                  </Tag>
                </Flex>
              ),
            },
            {
              title: "Why",
              key: "reason",
              width: 150,
              sorter: (a, b) => a.reason.localeCompare(b.reason),
              render: (_, m) => (
                <Tag color={"purple"}>
                  {m.reason === "same_leaf"
                    ? "duplicated root"
                    : "shared senders"}
                </Tag>
              ),
            },
            {
              title: "Senders shared",
              key: "overlap",
              width: 170,
              align: "right",
              sorter: (a, b) => a.senderOverlap - b.senderOverlap,
              defaultSortOrder: "descend",
              render: (_, m) => (
                <Mono>
                  {percent(m.senderOverlap)} of {m.fromSenders.toLocaleString()}
                </Mono>
              ),
            },
            {
              title: "Messages",
              key: "messages",
              width: 170,
              align: "right",
              sorter: (a, b) => a.fromMessages - b.fromMessages,
              render: (_, m) => (
                <Mono>
                  {m.fromMessages.toLocaleString()} →{" "}
                  {m.intoMessages.toLocaleString()}
                </Mono>
              ),
            },
            {
              title: "Last mail",
              key: "last",
              width: 150,
              render: (_, m) => (
                <Flex vertical={true}>
                  <LastMail time={m.fromLastReceivedTime} />
                  <LastMail time={m.intoLastReceivedTime} />
                </Flex>
              ),
            },
            {
              title: "",
              key: "preview",
              width: 140,
              render: (_, m) => (
                <Button
                  size={"small"}
                  icon={<MergeOutlined />}
                  onClick={() =>
                    setPair({ from: m.fromLabel, into: m.intoLabel })
                  }
                >
                  Preview merge
                </Button>
              ),
            },
          ]}
        />
      </div>
      <MergeLabelsDialog
        open={Boolean(pair)}
        onClose={() => setPair(undefined)}
        labels={labels}
        from={pair?.from}
        into={pair?.into}
      />
    </div>
  );
};

export default MergeCandidates;
