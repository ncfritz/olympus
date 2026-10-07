import type { MailAuditLabel } from "@ncfritz/olympus-sdk/minerva";
import {
  Flex,
  Progress,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import {
  isDormant,
  labelTree,
  type LabelNode,
  pruneTree,
} from "../../../../utils/mailAudit";
import type { LabelSplit } from "../../../../utils/mailClusters";

const { Text } = Typography;

const reviewHref = (name: string) =>
  `/minerva/mail/reclassification/label?name=${encodeURIComponent(name)}`;

/**
 * Proposals in and out as a split bar, scaled by square root to the
 * busiest label's: one label can hold most of them, and a linear scale
 * would leave the rest as dots.
 */
const ProposedBar: React.FunctionComponent<{
  inCount: number;
  outCount: number;
  max: number;
}> = ({ inCount, outCount, max }) => {
  if (inCount + outCount === 0) return <Text type={"secondary"}>–</Text>;
  const width = (n: number) =>
    `${Math.max(2, (100 * Math.sqrt(n)) / Math.sqrt(max))}%`;
  return (
    <Flex vertical={true} gap={2} style={{ minWidth: 140 }}>
      {inCount > 0 && (
        <Flex align={"center"} gap={6}>
          <div
            style={{ height: 6, width: width(inCount), background: "#1677ff" }}
          />
          <Text style={{ fontSize: 12 }}>+{inCount.toLocaleString()}</Text>
        </Flex>
      )}
      {outCount > 0 && (
        <Flex align={"center"} gap={6}>
          <div
            style={{ height: 6, width: width(outCount), background: "#fa541c" }}
          />
          <Text style={{ fontSize: 12 }}>−{outCount.toLocaleString()}</Text>
        </Flex>
      )}
    </Flex>
  );
};

/**
 * Every user label as a tree with its messages, the changes the audit
 * proposes into and out of it, and its flags (a split suggested by the
 * clustering among them); a label with proposals or a split links to its
 * review, where the split alert is.
 */
const LabelTreeTable: React.FunctionComponent<{
  labels: MailAuditLabel[];
  /** The labels the clustering would split, by full name. */
  splits?: Map<string, LabelSplit>;
}> = ({ labels, splits }) => {
  const [findingsOnly, setFindingsOnly] = useState(true);
  const tree = useMemo(() => labelTree(labels), [labels]);
  const shown = useMemo(
    () =>
      findingsOnly
        ? pruneTree(
            tree,
            (n) =>
              n.proposedIn + n.proposedOut > 0 ||
              n.mergeCandidate ||
              isDormant(n) ||
              (n.isLabel && !!splits?.has(n.key)),
          )
        : tree,
    [tree, findingsOnly, splits],
  );
  const max = Math.max(
    1,
    ...labels.map((l) => Math.max(l.proposedIn, l.proposedOut)),
  );

  const columns: ColumnsType<LabelNode> = [
    {
      title: "Label",
      key: "label",
      render: (_, n) => (
        <Tooltip title={n.key} mouseEnterDelay={0.6}>
          <Text type={n.isLabel ? undefined : "secondary"}>{n.leaf}</Text>
        </Tooltip>
      ),
    },
    {
      title: "Messages",
      dataIndex: "messages",
      align: "right",
      width: 110,
      sorter: (a, b) => a.messages - b.messages,
      render: (v: number, n) => (n.isLabel ? v.toLocaleString() : ""),
    },
    {
      title: "Proposed in / out",
      key: "proposed",
      width: 220,
      sorter: (a, b) =>
        a.proposedIn + a.proposedOut - (b.proposedIn + b.proposedOut),
      render: (_, n) => (
        <ProposedBar
          inCount={n.proposedIn}
          outCount={n.proposedOut}
          max={max}
        />
      ),
    },
    {
      title: "High confidence",
      dataIndex: "highConfidence",
      align: "right",
      width: 130,
      sorter: (a, b) => a.highConfidence - b.highConfidence,
      render: (v: number) => (v > 0 ? v.toLocaleString() : ""),
    },
    {
      title: "Processed",
      key: "processed",
      width: 150,
      sorter: (a, b) => a.processed - b.processed,
      render: (_, n) => {
        const total = n.proposedIn + n.proposedOut;
        if (!n.isLabel || total === 0) return "";
        const done = Math.round((100 * n.processed) / total);
        return (
          <Tooltip
            title={`${n.processed.toLocaleString()} of ${total.toLocaleString()} decided`}
          >
            <Progress
              percent={done}
              size={"small"}
              showInfo={true}
              style={{ margin: 0, width: 120 }}
            />
          </Tooltip>
        );
      },
    },
    {
      title: "Flags",
      key: "flags",
      render: (_, n) => (
        <Space size={4} wrap={true}>
          {n.mergeCandidate && <Tag color={"purple"}>merge candidate</Tag>}
          {n.isLabel && splits?.has(n.key) && (
            <Tooltip
              title={`${splits.get(n.key)?.groups} groups from different senders, ${splits.get(n.key)?.messages.toLocaleString()} messages: a sub-label each`}
            >
              <Tag color={"orange"}>split suggested</Tag>
            </Tooltip>
          )}
          {isDormant(n) && <Tag>no mail in 2 years</Tag>}
          {n.isLabel && n.messages === 0 && <Tag>empty</Tag>}
        </Space>
      ),
    },
    {
      title: "",
      key: "review",
      width: 80,
      render: (_, n) =>
        n.proposedIn + n.proposedOut > 0 ||
        (n.isLabel && splits?.has(n.key)) ? (
          <Link href={reviewHref(n.key)}>Review</Link>
        ) : null,
    },
  ];

  return (
    <Flex vertical={true} gap={8}>
      <Space size={8}>
        <Switch
          size={"small"}
          checked={findingsOnly}
          onChange={setFindingsOnly}
        />
        <Text>Only labels with findings</Text>
      </Space>
      <Table<LabelNode>
        size={"small"}
        rowKey={"key"}
        columns={columns}
        dataSource={shown}
        pagination={false}
        scroll={{ y: 560 }}
        expandable={{ defaultExpandAllRows: findingsOnly }}
        key={findingsOnly ? "findings" : "all"}
      />
    </Flex>
  );
};

export default LabelTreeTable;
