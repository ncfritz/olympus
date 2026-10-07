import { CheckOutlined, ExportOutlined, EyeOutlined } from "@ant-design/icons";
import type {
  ListMailOpenBillsResponse,
  MailOpenBill,
  MailOpenBillAges,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Descriptions,
  Empty,
  Flex,
  message,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import Link from "next/link";
import React, { useState } from "react";
import mailApi from "../../../api/mailApi";
import { useFetch } from "../../../hooks/useFetch";
import { apiProblems } from "../../../utils/goals";
import { gmailLink } from "../../../utils/mailAudit";
import {
  ageColors,
  billChange,
  openDays,
  stateName,
} from "../../../utils/mailPayments";
import { starName } from "../../../utils/mailStars";
import {
  CaretExpandIcon,
  ReceivedCell,
  SenderCell,
  SubjectCell,
} from "./MailCells";
import MessageViewer from "./MessageViewer";

const { Text } = Typography;

const PAGE_SIZE = 50;

const billKey = (b: MailOpenBill) => `${b.accountId}:${b.gmailId}`;

/** The pill's sections: under 30 days, 30 to 90, older. */
const AGES: {
  key: keyof MailOpenBillAges;
  title: string;
  days: number;
}[] = [
  { key: "month", title: "under 30 days", days: 0 },
  { key: "quarter", title: "30 to 90 days", days: 60 },
  { key: "older", title: "over 90 days", days: 120 },
];

/**
 * Open bills by age as one pill: a section each for under 30 days, 30 to
 * 90 and older, coloured as the table's Open column is.
 */
export const OpenBillAgesPill: React.FunctionComponent<{
  ages: MailOpenBillAges;
}> = ({ ages }) => (
  <span
    style={{
      display: "inline-flex",
      borderRadius: 10,
      overflow: "hidden",
      fontSize: 11,
      lineHeight: "18px",
      verticalAlign: "middle",
    }}
  >
    {AGES.map((a) => (
      <Tooltip key={a.key} title={`${ages[a.key].toLocaleString()} ${a.title}`}>
        <span
          aria-label={`${ages[a.key]} ${a.title}`}
          style={{ ...ageColors(a.days), padding: "0 7px", fontWeight: 600 }}
        >
          {ages[a.key].toLocaleString()}
        </span>
      </Tooltip>
    ))}
  </span>
);

export interface OpenBillsProps {
  /** A bill was marked, so the counts the page shows can follow. */
  onChanged?: () => void;
}

/**
 * The Inbox's Open bills tab (docs/plans/email-management phase 7 step
 * 2): the messages in an open state, oldest first, each one's age
 * coloured green to red, marked done along its family's transition by
 * hand when no payment was found for it. Its rows scroll inside it, in a
 * parent that fills the page (MailTable.module.css).
 */
const OpenBills: React.FunctionComponent<OpenBillsProps> = ({ onChanged }) => {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string>();
  const [opened, setOpened] = useState<MailOpenBill>();
  const [found, loading, , refresh] = useFetch<
    { page: number },
    ListMailOpenBillsResponse | undefined
  >({
    dataType: "open bills",
    params: { page },
    watch: [page],
    fetchFunction: async (p) =>
      (
        await mailApi.listOpenBills({
          offset: p.page * PAGE_SIZE,
          limit: PAGE_SIZE,
        })
      ).data,
  });

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

  /** Marks a bill done along its family's transition, once confirmed. */
  const markButton = (b: MailOpenBill) =>
    b.toLabel && (
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
    );

  return (
    <>
      <Table<MailOpenBill>
        size={"small"}
        rowKey={billKey}
        loading={loading}
        dataSource={found?.bills ?? []}
        scroll={{ y: 1 }}
        tableLayout={"fixed"}
        expandable={{
          expandIcon: (p) => (
            <CaretExpandIcon {...p} label={p.record.subject ?? "the bill"} />
          ),
          expandedRowRender: (b) => (
            <Flex vertical={true} gap={8} style={{ padding: "4px 8px" }}>
              <Descriptions
                size={"small"}
                column={1}
                items={[
                  {
                    key: "snippet",
                    label: "Snippet",
                    children: <Text style={{ fontSize: 12 }}>{b.snippet}</Text>,
                  },
                  {
                    key: "state",
                    label: "State",
                    children: b.toLabel
                      ? `${b.label}, ${stateName(b.toLabel)} next (${b.toLabel})`
                      : b.label,
                  },
                  {
                    key: "star",
                    label: "Star",
                    children: b.starred ? (
                      starName(b.starIcon)
                    ) : (
                      <Text type={"secondary"}>none</Text>
                    ),
                  },
                ]}
              />
              <Space size={8}>
                <Button
                  size={"small"}
                  icon={<EyeOutlined />}
                  onClick={() => setOpened(b)}
                >
                  Open message
                </Button>
                <Button
                  size={"small"}
                  icon={<ExportOutlined />}
                  href={gmailLink(b.gmailId)}
                  target={"_blank"}
                  rel={"noreferrer"}
                >
                  Open in Gmail
                </Button>
                {markButton(b)}
              </Space>
            </Flex>
          ),
        }}
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
          total: found?.count ?? 0,
          showSizeChanger: false,
          onChange: (p) => setPage(p - 1),
        }}
        columns={[
          {
            title: "Open",
            key: "age",
            width: 90,
            align: "center",
            onCell: (b) => ({ style: ageColors(openDays(b)) }),
            render: (_, b) => `${openDays(b)} days`,
          },
          {
            title: "From",
            key: "from",
            width: 220,
            render: (_, b) => (
              <SenderCell name={b.fromName} address={b.fromAddress} />
            ),
          },
          {
            title: "Subject",
            key: "subject",
            render: (_, b) => (
              <SubjectCell subject={b.subject} snippet={b.snippet} />
            ),
          },
          {
            title: "State",
            key: "state",
            width: 180,
            render: (_, b) => <Tag color={"volcano"}>{b.label}</Tag>,
          },
          {
            title: "Received",
            key: "received",
            width: 96,
            render: (_, b) => <ReceivedCell time={String(b.receivedTime)} />,
          },
          {
            title: "",
            key: "actions",
            width: 190,
            render: (_, b) => (
              <Space size={4}>
                <Tooltip title={"Open message"}>
                  <Button
                    shape={"circle"}
                    size={"small"}
                    icon={<EyeOutlined />}
                    aria-label={`Open ${b.subject ?? "the bill"}`}
                    onClick={() => setOpened(b)}
                  />
                </Tooltip>
                <Tooltip title={"Open in Gmail"}>
                  <Button
                    shape={"circle"}
                    size={"small"}
                    icon={<ExportOutlined />}
                    aria-label={`Open ${b.subject ?? "the bill"} in Gmail`}
                    href={gmailLink(b.gmailId)}
                    target={"_blank"}
                    rel={"noreferrer"}
                  />
                </Tooltip>
                {markButton(b)}
              </Space>
            ),
          },
        ]}
      />
      <MessageViewer message={opened} onClose={() => setOpened(undefined)} />
    </>
  );
};

export default OpenBills;
