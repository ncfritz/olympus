import { CheckOutlined, DollarOutlined } from "@ant-design/icons";
import type {
  ListMailOpenBillsResponse,
  MailOpenBill,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Collapse,
  Empty,
  Flex,
  message,
  Popconfirm,
  Space,
  Table,
  type TableProps,
  Tag,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useState } from "react";
import mailApi from "../../../api/mailApi";
import { useFetch } from "../../../hooks/useFetch";
import { apiProblems } from "../../../utils/goals";
import { gmailLink } from "../../../utils/mailAudit";
import { billChange, openDays, stateName } from "../../../utils/mailPayments";

const { Text } = Typography;

const PAGE_SIZE = 20;

export interface OpenBillsProps {
  /**
   * The Inbox's Open bills tab: the ages and the table, always shown;
   * otherwise a fold that shows only with bills open.
   */
  embedded?: boolean;
  /** The table header's stickiness, as the page's scroller needs it. */
  sticky?: TableProps<MailOpenBill>["sticky"];
  /** A bill was marked, so the counts the page shows can follow. */
  onChanged?: () => void;
}

/**
 * Open payables by age (docs/plans/email-management phase 7 step 2): the
 * messages in an open state, oldest first, each marked done along its
 * family's transition by hand when no payment was found for it.
 */
const OpenBills: React.FunctionComponent<OpenBillsProps> = ({
  embedded = false,
  sticky,
  onChanged,
}) => {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string>();
  const [found, loading, , refresh] = useFetch<
    { page: number },
    ListMailOpenBillsResponse | undefined
  >({
    dataType: "open bills",
    params: { page },
    watch: [page],
    quiet: true,
    fetchFunction: async (p) =>
      (
        await mailApi.listOpenBills({
          offset: p.page * PAGE_SIZE,
          limit: PAGE_SIZE,
        })
      ).data,
  });
  if (!embedded && (!found || found.count === 0)) return null;

  const close = async (b: MailOpenBill) => {
    const change = billChange(b);
    if (!change) return;
    setBusy(b.gmailId);
    try {
      await mailApi.applyChanges(b.accountId, [change]);
      message.success(
        <span>
          Marking it {stateName(b.toLabel as string)} in Gmail.{" "}
          <Link href={"/minerva/mail/changes"}>
            Follow it in the change log
          </Link>
        </span>,
      );
      setTimeout(() => {
        void refresh(true);
        onChanged?.();
      }, 4000);
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(undefined);
    }
  };

  const { month, quarter, older } = found?.ages ?? {
    month: 0,
    quarter: 0,
    older: 0,
  };
  const count = found?.count ?? 0;
  const ages = (
    <Space size={8} wrap={true}>
      <Tag>{month.toLocaleString()} under 30 days</Tag>
      <Tag color={quarter ? "gold" : undefined}>
        {quarter.toLocaleString()} 30–90 days
      </Tag>
      <Tag color={older ? "volcano" : undefined}>
        {older.toLocaleString()} older
      </Tag>
    </Space>
  );
  const table = (
    <Table<MailOpenBill>
      size={"small"}
      rowKey={(b) => `${b.accountId}:${b.gmailId}`}
      loading={loading}
      dataSource={found?.bills ?? []}
      sticky={sticky}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={"No bills open."}
          />
        ),
      }}
      pagination={{
        current: page + 1,
        pageSize: PAGE_SIZE,
        total: count,
        showSizeChanger: false,
        onChange: (p) => setPage(p - 1),
      }}
      columns={COLUMNS(busy, close)}
    />
  );

  if (embedded) {
    return (
      <Flex vertical={true} gap={12}>
        {ages}
        {table}
      </Flex>
    );
  }
  return (
    <Collapse
      size={"small"}
      items={[
        {
          key: "bills",
          label: (
            <Space size={8} wrap={true}>
              <DollarOutlined />
              <Text strong={true}>
                {count.toLocaleString()} open {count === 1 ? "bill" : "bills"}
              </Text>
              {ages}
            </Space>
          ),
          children: table,
        },
      ]}
    />
  );
};

/** The table's columns: a bill's age, sender, subject, state and Mark. */
const COLUMNS = (
  busy: string | undefined,
  close: (b: MailOpenBill) => Promise<void>,
): TableProps<MailOpenBill>["columns"] => [
  {
    title: "Open",
    key: "age",
    width: 90,
    render: (_, b) => `${openDays(b)} days`,
  },
  {
    title: "Received",
    key: "received",
    width: 120,
    render: (_, b) =>
      DateTime.fromISO(String(b.receivedTime)).toLocaleString(
        DateTime.DATE_MED,
      ),
  },
  {
    title: "From",
    key: "from",
    ellipsis: true,
    render: (_, b) => b.fromAddress,
  },
  {
    title: "Subject",
    key: "subject",
    ellipsis: true,
    render: (_, b) => (
      <a href={gmailLink(b.gmailId)} target={"_blank"} rel={"noreferrer"}>
        {b.subject ?? "(no subject)"}
      </a>
    ),
  },
  {
    title: "State",
    key: "state",
    render: (_, b) => <Tag color={"volcano"}>{b.label}</Tag>,
  },
  {
    title: "",
    key: "close",
    width: 150,
    render: (_, b) =>
      b.toLabel ? (
        <Popconfirm
          title={`Mark it ${stateName(b.toLabel)}?`}
          description={`${b.label} comes off and ${b.toLabel} goes on, in Gmail. It can be undone from the change log.`}
          okText={"Mark"}
          onConfirm={() => close(b)}
        >
          <Button
            size={"small"}
            icon={<CheckOutlined />}
            loading={busy === b.gmailId}
          >
            Mark {stateName(b.toLabel)}
          </Button>
        </Popconfirm>
      ) : (
        <Flex>
          <Text type={"secondary"}>No transition</Text>
        </Flex>
      ),
  },
];

export default OpenBills;
