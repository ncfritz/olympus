import { FilterFilled } from "@ant-design/icons";
import type { MailAuditLabel } from "@ncfritz/olympus-sdk/minerva";
import {
  Flex,
  Progress,
  Space,
  Switch,
  Table,
  Tag,
  theme,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { ThermometerIcon } from "../../../../icons";
import {
  highConfidenceShare,
  LABEL_FLAGS,
  type LabelFlag,
  labelFlags,
  labelTree,
  type LabelNode,
  pruneTree,
} from "../../../../utils/mailAudit";
import type { LabelSplit } from "../../../../utils/mailClusters";
import { textFilterOf } from "../../../../utils/mailInbox";
import { hueColors } from "../../../../utils/mailPayments";
import { Mono, TextFilterDropdown } from "../MailCells";
import tableStyles from "../MailTable.module.css";

const { Text } = Typography;

const reviewHref = (name: string) =>
  `/minerva/mail/reclassification/label?name=${encodeURIComponent(name)}`;

/** The columns' widths; Processed takes what is left. */
const LABEL_WIDTH = 250;
const PROPOSED_WIDTH = 400;
const FLAGS_WIDTH = 250;
const REVIEW_WIDTH = 80;
/** HC: the count over its share, "22,282" and "(100%)" in the code font. */
const HC_WIDTH = 75;
/** Processed's progress bar: at most this wide, the column what is left. */
const PROCESSED_BAR_WIDTH = 350;
/** The least room Processed's bar is given. */
const PROCESSED_MIN_WIDTH = 120;
/**
 * The table's least width: every column's, and Processed's least. Wider
 * than the table's space (at 1440px), it scrolls sideways within itself;
 * narrower, the table fills the space and Processed takes the rest.
 */
const TABLE_WIDTH =
  LABEL_WIDTH +
  110 +
  PROPOSED_WIDTH +
  HC_WIDTH +
  PROCESSED_MIN_WIDTH +
  16 +
  FLAGS_WIDTH +
  REVIEW_WIDTH;
/** The count beside each proposed bar. */
const PROPOSED_COUNT_WIDTH = 64;

/**
 * Proposals in and out as a split bar, scaled by square root to the
 * busiest label's: one label can hold most of them, and a linear scale
 * would leave the rest as dots. Each bar runs in a track as wide as the
 * column allows, its count beside it.
 */
const ProposedBar: React.FunctionComponent<{
  inCount: number;
  outCount: number;
  max: number;
}> = ({ inCount, outCount, max }) => {
  if (inCount + outCount === 0) return <Text type={"secondary"}>–</Text>;
  const width = (n: number) =>
    `${Math.max(2, (100 * Math.sqrt(n)) / Math.sqrt(max))}%`;
  const bar = (n: number, sign: string, color: string) => (
    <Flex align={"center"} gap={6}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ height: 6, width: width(n), background: color }} />
      </div>
      <Mono style={{ width: PROPOSED_COUNT_WIDTH }}>
        {sign}
        {n.toLocaleString()}
      </Mono>
    </Flex>
  );
  return (
    <Flex vertical={true} gap={2}>
      {inCount > 0 && bar(inCount, "+", "#1677ff")}
      {outCount > 0 && bar(outCount, "−", "#fa541c")}
    </Flex>
  );
};

/** The keys of every row with children, to open them all. */
const parentKeys = (nodes: LabelNode[]): string[] =>
  nodes.flatMap((n) =>
    n.children?.length ? [n.key, ...parentKeys(n.children)] : [],
  );

const FLAG_TAGS: Record<LabelFlag, { color?: string; text: string }> = {
  merge: { color: "purple", text: "merge candidate" },
  split: { color: "orange", text: "split suggested" },
  dormant: { text: "no mail in 2 years" },
  empty: { text: "empty" },
};

/**
 * Every user label as a tree with its messages, the changes the audit
 * proposes into and out of it, the share of them at high confidence, and
 * its flags (a split suggested by the clustering among them); a label with
 * proposals or a split links to its review, where the split alert is. The
 * labels filter by name and by flag, a match keeping its parents.
 */
const LabelTreeTable: React.FunctionComponent<{
  labels: MailAuditLabel[];
  /** The labels the clustering would split, by full name. */
  splits?: Map<string, LabelSplit>;
}> = ({ labels, splits }) => {
  const { token } = theme.useToken();
  const [findingsOnly, setFindingsOnly] = useState(true);
  const [search, setSearch] = useState<string>();
  const [flags, setFlags] = useState<LabelFlag[]>([]);
  const tree = useMemo(() => labelTree(labels), [labels]);
  const shown = useMemo(() => {
    const term = search?.toLowerCase();
    const filtering = findingsOnly || term !== undefined || flags.length > 0;
    return filtering
      ? pruneTree(tree, (n) => {
          const has = labelFlags(n, splits);
          return (
            (!findingsOnly ||
              n.proposedIn + n.proposedOut > 0 ||
              has.length > 0) &&
            (term === undefined || n.key.toLowerCase().includes(term)) &&
            (flags.length === 0 || flags.some((f) => has.includes(f)))
          );
        })
      : tree;
  }, [tree, findingsOnly, search, flags, splits]);
  // Filtered, every row that has children opens, so what matched shows;
  // unfiltered, the tree starts closed.
  const [expanded, setExpanded] = useState<string[]>([]);
  useEffect(() => {
    const filtering = findingsOnly || search !== undefined || flags.length > 0;
    setExpanded(filtering ? parentKeys(shown) : []);
  }, [shown]);
  const max = Math.max(
    1,
    ...labels.map((l) => Math.max(l.proposedIn, l.proposedOut)),
  );
  const filterIcon = (on: boolean, Icon = FilterFilled) => (
    <Icon style={on ? { color: token.colorPrimary } : undefined} />
  );

  const columns: ColumnsType<LabelNode> = [
    {
      title: "Label",
      key: "label",
      width: LABEL_WIDTH,
      filteredValue: search ? [search] : null,
      filterIcon: (on) => filterIcon(on, FilterFilled),
      filterDropdown: (p) => (
        <TextFilterDropdown {...p} placeholder={"Label name"} />
      ),
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
      render: (v: number, n) =>
        n.isLabel ? <Mono>{v.toLocaleString()}</Mono> : "",
    },
    {
      title: "Proposed in / out",
      key: "proposed",
      width: PROPOSED_WIDTH,
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
      title: (
        <Tooltip title={"High confidence: the proposals at 90% or more"}>
          <Space size={4}>
            <ThermometerIcon />
            <span>HC</span>
          </Space>
        </Tooltip>
      ),
      key: "highConfidence",
      align: "right",
      width: HC_WIDTH,
      sorter: (a, b) => a.highConfidence - b.highConfidence,
      onCell: (n) => {
        const share = highConfidenceShare(n);
        return share === undefined || n.highConfidence === 0
          ? {}
          : { style: hueColors(120 * share) };
      },
      render: (_, n) => {
        const share = highConfidenceShare(n);
        return n.highConfidence > 0 && share !== undefined ? (
          <Flex vertical={true} align={"flex-end"}>
            <Mono>{n.highConfidence.toLocaleString()}</Mono>
            <Mono>({Math.round(share * 100)}%)</Mono>
          </Flex>
        ) : (
          ""
        );
      },
    },
    {
      title: "Processed",
      key: "processed",
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
              style={{
                margin: 0,
                width: "100%",
                maxWidth: PROCESSED_BAR_WIDTH,
              }}
            />
          </Tooltip>
        );
      },
    },
    {
      title: "Flags",
      key: "flags",
      width: FLAGS_WIDTH,
      filters: LABEL_FLAGS,
      filteredValue: flags.length ? flags : null,
      filterIcon: (on) => filterIcon(on, FilterFilled),
      render: (_, n) => (
        <Space size={4} wrap={true}>
          {labelFlags(n, splits).map((f) =>
            f === "split" ? (
              <Tooltip
                key={f}
                title={`${splits?.get(n.key)?.groups} groups from different senders, ${splits?.get(n.key)?.messages.toLocaleString()} messages: a sub-label each`}
              >
                <Tag color={FLAG_TAGS[f].color}>{FLAG_TAGS[f].text}</Tag>
              </Tooltip>
            ) : (
              <Tag key={f} color={FLAG_TAGS[f].color}>
                {FLAG_TAGS[f].text}
              </Tag>
            ),
          )}
        </Space>
      ),
    },
    {
      title: "",
      key: "review",
      width: REVIEW_WIDTH,
      render: (_, n) =>
        n.proposedIn + n.proposedOut > 0 ||
        (n.isLabel && splits?.has(n.key)) ? (
          <Link href={reviewHref(n.key)}>Review</Link>
        ) : null,
    },
  ];

  return (
    <div className={tableStyles.column}>
      <Space size={8}>
        <Switch
          size={"small"}
          checked={findingsOnly}
          onChange={setFindingsOnly}
        />
        <Text>Only labels with findings</Text>
      </Space>
      <div className={tableStyles.fill}>
        <Table<LabelNode>
          size={"small"}
          rowKey={"key"}
          columns={columns}
          dataSource={shown}
          pagination={false}
          tableLayout={"fixed"}
          scroll={{ x: TABLE_WIDTH, y: 1 }}
          onChange={(_, filters) => {
            setSearch(textFilterOf(filters.label));
            setFlags((filters.flags ?? []) as LabelFlag[]);
          }}
          expandable={{
            expandedRowKeys: expanded,
            onExpandedRowsChange: (keys) => setExpanded(keys as string[]),
          }}
          locale={{ emptyText: "No labels match." }}
        />
      </div>
    </div>
  );
};

export default LabelTreeTable;
