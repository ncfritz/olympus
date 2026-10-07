import { CheckOutlined, DollarOutlined } from "@ant-design/icons";
import type {
  ListMailOpenBillsResponse,
  MailOpenBill,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Collapse,
  Flex,
  message,
  Popconfirm,
  Space,
  Table,
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

/**
 * Open payables by age (docs/plans/email-management phase 7 step 2): the
 * messages in an open state, oldest first, each marked done along its
 * family's transition by hand when no payment was found for it. Nothing
 * shows without one.
 */
const OpenBills: React.FunctionComponent = () => {
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
  if (!found || found.count === 0) return null;

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
      setTimeout(() => void refresh(true), 4000);
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(undefined);
    }
  };

  const { month, quarter, older } = found.ages;
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
                {found.count.toLocaleString()} open{" "}
                {found.count === 1 ? "bill" : "bills"}
              </Text>
              <Tag>{month.toLocaleString()} under 30 days</Tag>
              <Tag color={quarter ? "gold" : undefined}>
                {quarter.toLocaleString()} 30–90 days
              </Tag>
              <Tag color={older ? "volcano" : undefined}>
                {older.toLocaleString()} older
              </Tag>
            </Space>
          ),
          children: (
            <Table<MailOpenBill>
              size={"small"}
              rowKey={(b) => `${b.accountId}:${b.gmailId}`}
              loading={loading}
              dataSource={found.bills}
              pagination={{
                current: page + 1,
                pageSize: PAGE_SIZE,
                total: found.count,
                showSizeChanger: false,
                onChange: (p) => setPage(p - 1),
              }}
              columns={[
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
                    <a
                      href={gmailLink(b.gmailId)}
                      target={"_blank"}
                      rel={"noreferrer"}
                    >
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
              ]}
            />
          ),
        },
      ]}
    />
  );
};

export default OpenBills;
