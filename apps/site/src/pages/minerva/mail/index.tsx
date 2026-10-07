import {
  CheckOutlined,
  ContainerOutlined,
  DownOutlined,
  EyeOutlined,
  ForwardOutlined,
  HistoryOutlined,
  InboxOutlined,
  MailOutlined,
  ReadOutlined,
  RightOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type {
  ListMailInboxResponse,
  ListMailOpenBillsResponse,
  MailAccount,
  MailInboxMessage,
  MailInboxStatus,
  MailLabel,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  Button,
  Drawer,
  Flex,
  Input,
  message,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  theme,
  Tooltip,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import mailApi, { type MailInboxSort } from "../../../api/mailApi";
import InboxStrip from "../../../components/minerva/mail/InboxStrip";
import OpenBills, {
  OpenBillAgesPill,
} from "../../../components/minerva/mail/OpenBills";
import {
  ReceivedCell,
  SenderCell,
  SubjectCell,
} from "../../../components/minerva/mail/MailCells";
import FilterProposals from "../../../components/minerva/mail/FilterProposals";
import {
  CurrentLabels,
  SuggestedLabels,
} from "../../../components/minerva/mail/InboxLabels";
import InboxReviewPanel, {
  type ReviewOutcome,
  useApproveOptions,
} from "../../../components/minerva/mail/InboxReviewPanel";
import {
  approveSuggested,
  flagAll,
  highConfidenceToReview,
  skipAll,
} from "../../../components/minerva/mail/inboxActions";
import MailAccountsCard from "../../../components/minerva/mail/MailAccountsCard";
import MailBreadcrumbs from "../../../components/minerva/mail/MailBreadcrumbs";
import MessageViewer from "../../../components/minerva/mail/MessageViewer";
import { useFetch } from "../../../hooks/useFetch";
import { apiProblems } from "../../../utils/goals";
import {
  MAIL_LINK_OUTCOME_KEYS,
  type MailLinkOutcome,
  mailLinkOutcome,
  mailReturnTo,
} from "../../../utils/mailAccounts";
import { nextToReview, startOfToday } from "../../../utils/mailInbox";

const { Title, Text } = Typography;

const PAGE_SIZE = 50;

const STATUSES: { label: string; value: MailInboxStatus }[] = [
  { label: "To review", value: "review" },
  { label: "Unread", value: "unread" },
  { label: "Approved today", value: "approved" },
  { label: "All", value: "all" },
];

const CONFIDENCES = [
  { label: "Any confidence", value: 0 },
  { label: "≥ 80%", value: 0.8 },
  { label: "≥ 90%", value: 0.9 },
  { label: "≥ 95%", value: 0.95 },
];

type Filters = {
  status: MailInboxStatus;
  search?: string;
  minConfidence?: number;
  sortBy: MailInboxSort;
  page: number;
};

const key = (m: MailInboxMessage) => `${m.accountId}/${m.gmailId}`;

/** The Inbox's tabs: the inbox by status, or the open bills. */
type InboxView = MailInboxStatus | "bills";

/**
 * Mail's inbox (docs/plans/email-management phase 5; design.md): each
 * message with its labels and what the classifier suggested as it
 * arrived, to approve (writing the labels to Gmail, archiving and marking
 * read as chosen), amend in the label picker, skip or open; and the
 * mailboxes, linked to Gmail from their drawer.
 */
const MailInboxPage: React.FunctionComponent = () => {
  const router = useRouter();
  const [outcome, setOutcome] = useState<MailLinkOutcome>();
  const [filters, setFilters] = useState<Filters>({
    status: "review",
    sortBy: "receivedTime",
    page: 0,
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MailInboxMessage[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [opened, setOpened] = useState<MailInboxMessage>();
  const [busy, setBusy] = useState(false);
  const [options] = useApproveOptions();
  const [view, setView] = useState<InboxView>("review");
  const [mailboxesOpen, setMailboxesOpen] = useState(false);
  const { token } = theme.useToken();

  // One scroller: what is above the table stays put, and the table's
  // header sticks under it.
  const scroller = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  useEffect(() => {
    const el = header.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    watch.observe(el);
    setHeaderHeight(el.offsetHeight);
    return () => watch.disconnect();
  }, []);
  const sticky = {
    offsetHeader: headerHeight,
    getContainer: () => scroller.current ?? window,
  };

  const [bills, , , refetchBills] = useFetch<
    Record<string, never>,
    ListMailOpenBillsResponse | undefined
  >({
    dataType: "open bills",
    params: {},
    watch: [],
    quiet: true,
    fetchFunction: async () => (await mailApi.listOpenBills({ limit: 1 })).data,
  });

  const [accounts, accountsLoading] = useFetch<
    Record<string, never>,
    MailAccount[]
  >({
    dataType: "mail accounts",
    params: {},
    watch: [],
    default: [],
    fetchFunction: async () => (await mailApi.listAccounts()).data.accounts,
  });
  const [labels] = useFetch<Record<string, never>, MailLabel[]>({
    dataType: "mail labels",
    params: {},
    watch: [],
    default: [],
    fetchFunction: async () => (await mailApi.listLabels()).data.labels,
  });
  const [inbox, loading, , refetch] = useFetch<
    Filters,
    ListMailInboxResponse | undefined
  >({
    dataType: "inbox",
    params: filters,
    watch: [filters],
    fetchFunction: async (f) =>
      (
        await mailApi.listInbox({
          status: f.status,
          ...(f.search ? { search: f.search } : {}),
          ...(f.minConfidence ? { minConfidence: f.minConfidence } : {}),
          approvedSince: startOfToday(),
          sortBy: f.sortBy,
          pageSize: PAGE_SIZE,
          startPage: f.page,
        })
      ).data,
  });
  useEffect(() => setSelected([]), [filters]);

  // What Google's sign-in came back with, shown once.
  useEffect(() => {
    if (!router.isReady) return;
    const said = mailLinkOutcome(router.query);
    if (!said) return;
    setOutcome(said);
    const query = { ...router.query };
    for (const k of MAIL_LINK_OUTCOME_KEYS) delete query[k];
    void router.replace({ query }, undefined, { shallow: true });
  }, [router.isReady, router.query, router]);

  const connect = async (account: MailAccount) => {
    try {
      const response = await mailApi.connectAccount(
        account.id,
        mailReturnTo(window.location.origin),
      );
      window.location.assign(response.data.authUrl);
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    }
  };

  /** Runs an action over messages, then reloads once it is written. */
  const act = async (work: () => Promise<string>) => {
    setBusy(true);
    try {
      message.success(
        <span>
          {await work()}{" "}
          <Link href={"/minerva/mail/changes"}>
            Follow it in the change log
          </Link>
        </span>,
      );
      setSelected([]);
      await refetch(true);
      // Gmail's side lands a few seconds later.
      setTimeout(() => void refetch(true), 5000);
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(false);
    }
  };

  const reviewed = (m: MailInboxMessage, done: ReviewOutcome) => {
    // Approved: the next message to review opens in its place.
    const next =
      done.kind === "approved"
        ? nextToReview(inbox?.messages ?? [], m)
        : undefined;
    setExpanded((e) => [
      ...e.filter((k) => k !== key(m) && (!next || k !== key(next))),
      ...(next ? [key(next)] : []),
    ]);
    message.success(
      done.kind === "skipped"
        ? "Skipped: Gmail unchanged"
        : done.batch
          ? "Approved: writing to Gmail"
          : "Approved: Gmail needed no change",
    );
    void refetch(true);
    setTimeout(() => void refetch(true), 5000);
  };

  const acceptAll = () =>
    act(async () => {
      const found = await highConfidenceToReview();
      if (found.length === 0) return "Nothing to review at 90% or more.";
      const done = await approveSuggested(found, options);
      return `Approved ${done.messages.toLocaleString()} as suggested.`;
    });

  const summary = inbox?.summary;
  const linked = accounts.some((a) => a.linkedTime);

  return (
    <>
      <MailBreadcrumbs
        trail={[
          <Space key={"page"} size={4}>
            <InboxOutlined />
            <span>Inbox</span>
          </Space>,
        ]}
      />
      <div
        ref={scroller}
        style={{
          height: "calc(100vh - 92px)",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <div
          ref={header}
          style={{
            position: "sticky",
            top: 0,
            zIndex: 3,
            background: token.colorBgContainer,
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
                Inbox
              </Title>
              <Text type={"secondary"} style={{ fontSize: 15 }}>
                {summary
                  ? `${summary.toReview.toLocaleString()} to review`
                  : "Suggested labels for new mail"}
              </Text>
            </Space>
            <Space wrap={true}>
              <Button
                icon={<MailOutlined />}
                onClick={() => setMailboxesOpen(true)}
              >
                Mailboxes
              </Button>
              <Link href={"/minerva/mail/changes"}>
                <Button icon={<HistoryOutlined />}>Change log</Button>
              </Link>
              <Popconfirm
                title={`Accept all ${summary?.highConfidence.toLocaleString() ?? ""} at 90% or more?`}
                description={`Each gets its ticked suggestion in Gmail${
                  options.archive ? ", archived" : ""
                }${options.markRead ? ", marked read" : ""}. Each batch can be undone from the change log.`}
                okText={"Accept all"}
                onConfirm={() => void acceptAll()}
                disabled={!summary?.highConfidence}
              >
                <Button
                  type={"primary"}
                  icon={<ThunderboltOutlined />}
                  loading={busy}
                  disabled={!summary?.highConfidence}
                >
                  Accept all ≥ 90%
                </Button>
              </Popconfirm>
            </Space>
          </Flex>

          <Flex vertical={true} gap={16} style={{ padding: "0 16px" }}>
            {outcome && (
              <Alert
                type={outcome.type}
                showIcon={true}
                closable={true}
                onClose={() => setOutcome(undefined)}
                message={outcome.title}
                description={outcome.description}
              />
            )}
            {!accountsLoading && !linked && (
              <Alert
                type={"info"}
                showIcon={true}
                message={
                  "No mailbox is linked to Gmail yet: link one to see new mail here."
                }
                action={
                  <Button
                    size={"small"}
                    type={"primary"}
                    onClick={() => setMailboxesOpen(true)}
                  >
                    Link a mailbox
                  </Button>
                }
              />
            )}
            <InboxStrip summary={summary} loading={!inbox && loading} />
            <FilterProposals accounts={accounts} onAllow={connect} />

            <Tabs
              activeKey={view}
              onChange={(v) => {
                setView(v as InboxView);
                if (v !== "bills") {
                  setFilters((f) => ({
                    ...f,
                    status: v as MailInboxStatus,
                    page: 0,
                  }));
                }
              }}
              tabBarStyle={{ marginBottom: 0 }}
              items={[
                ...STATUSES.map((s) => ({
                  key: s.value as string,
                  label:
                    s.value === "review" && summary
                      ? `To review · ${summary.toReview}`
                      : s.value === "unread" && summary
                        ? `Unread · ${summary.unread}`
                        : s.label,
                })),
                {
                  key: "bills",
                  label: (
                    <Space size={6}>
                      <span>Open bills</span>
                      {bills && bills.count > 0 && (
                        <OpenBillAgesPill ages={bills.ages} />
                      )}
                    </Space>
                  ),
                },
              ]}
              tabBarExtraContent={
                view === "bills" ? undefined : (
                  <Space wrap={true}>
                    <Input.Search
                      allowClear={true}
                      placeholder={"Search sender or subject"}
                      size={"small"}
                      style={{ width: 140 }}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onSearch={(v) =>
                        setFilters((f) => ({
                          ...f,
                          search: v.trim() || undefined,
                          page: 0,
                        }))
                      }
                    />
                    <Select
                      size={"small"}
                      style={{ width: 145 }}
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
                      size={"small"}
                      options={[
                        { label: "Newest", value: "receivedTime" },
                        { label: "Most confident", value: "confidence" },
                      ]}
                      value={filters.sortBy}
                      onChange={(v) =>
                        setFilters((f) => ({
                          ...f,
                          sortBy: v as MailInboxSort,
                          page: 0,
                        }))
                      }
                    />
                  </Space>
                )
              }
            />

            {view !== "bills" && selected.length > 0 && (
              <Alert
                type={"info"}
                message={
                  <Flex justify={"space-between"} align={"center"} wrap={true}>
                    <Text>{selected.length.toLocaleString()} selected</Text>
                    <Space wrap={true}>
                      <Button
                        type={"primary"}
                        icon={<CheckOutlined />}
                        loading={busy}
                        onClick={() =>
                          void act(async () => {
                            const done = await approveSuggested(
                              selected,
                              options,
                            );
                            return `Approved ${done.messages.toLocaleString()} as suggested.`;
                          })
                        }
                      >
                        Approve suggested
                      </Button>
                      <Button
                        icon={<ForwardOutlined />}
                        loading={busy}
                        onClick={() =>
                          void act(
                            async () =>
                              `Skipped ${(await skipAll(selected)).toLocaleString()}; Gmail unchanged.`,
                          )
                        }
                      >
                        Skip
                      </Button>
                      <Button
                        icon={<ReadOutlined />}
                        loading={busy}
                        onClick={() =>
                          void act(async () => {
                            const done = await flagAll(selected, {
                              markRead: true,
                            });
                            return `Marking ${done.messages.toLocaleString()} read.`;
                          })
                        }
                      >
                        Mark read
                      </Button>
                      <Button
                        icon={<ContainerOutlined />}
                        loading={busy}
                        onClick={() =>
                          void act(async () => {
                            const done = await flagAll(selected, {
                              archive: true,
                            });
                            return `Archiving ${done.messages.toLocaleString()}.`;
                          })
                        }
                      >
                        Archive
                      </Button>
                      <Button type={"text"} onClick={() => setSelected([])}>
                        Clear
                      </Button>
                    </Space>
                  </Flex>
                }
              />
            )}
          </Flex>
        </div>

        <Flex vertical={true} gap={16} style={{ padding: "0 16px 16px" }}>
          {view === "bills" ? (
            <OpenBills
              sticky={sticky}
              onChanged={() => void refetchBills(true)}
            />
          ) : (
            <Table<MailInboxMessage>
              size={"small"}
              loading={loading}
              dataSource={inbox?.messages ?? []}
              rowKey={key}
              sticky={sticky}
              tableLayout={"fixed"}
              rowSelection={{
                selectedRowKeys: selected.map(key),
                onChange: (_, rows) => setSelected(rows),
              }}
              expandable={{
                expandedRowKeys: expanded,
                expandIcon: ({ expanded: open, onExpand, record }) => (
                  <Button
                    type={"text"}
                    size={"small"}
                    icon={open ? <DownOutlined /> : <RightOutlined />}
                    aria-label={`${open ? "Close" : "Review"} ${record.subject ?? "message"}`}
                    aria-expanded={open}
                    onClick={(e) => onExpand(record, e)}
                  />
                ),
                onExpand: (open, m) =>
                  setExpanded((e) =>
                    open ? [...e, key(m)] : e.filter((k) => k !== key(m)),
                  ),
                expandedRowRender: (m) =>
                  m.decision ? (
                    <Text type={"secondary"} style={{ padding: 8 }}>
                      {m.decision === "approved"
                        ? `Approved${m.amended ? " with changes" : ""}`
                        : "Skipped"}{" "}
                      {m.decidedTime
                        ? DateTime.fromISO(String(m.decidedTime)).toRelative()
                        : ""}
                      .
                    </Text>
                  ) : (
                    <InboxReviewPanel
                      message={m}
                      labels={labels}
                      columns={true}
                      onOpen={setOpened}
                      onDone={reviewed}
                    />
                  ),
              }}
              pagination={{
                current: filters.page + 1,
                pageSize: PAGE_SIZE,
                total: inbox?.count ?? 0,
                showSizeChanger: false,
                onChange: (p) => setFilters((f) => ({ ...f, page: p - 1 })),
              }}
              locale={{
                emptyText:
                  filters.status === "review"
                    ? "Nothing to review."
                    : "No messages here.",
              }}
              columns={[
                {
                  title: "From",
                  key: "from",
                  width: 180,
                  render: (_, m) => (
                    <SenderCell
                      name={m.fromName}
                      address={m.fromAddress}
                      unread={m.unread}
                    />
                  ),
                },
                {
                  title: "Subject",
                  key: "subject",
                  ellipsis: true,
                  render: (_, m) => (
                    <SubjectCell
                      subject={m.subject}
                      snippet={m.snippet}
                      unread={m.unread}
                    />
                  ),
                },
                {
                  title: "Current labels",
                  key: "labels",
                  width: 200,
                  render: (_, m) => <CurrentLabels labels={m.labels} max={3} />,
                },
                {
                  title: "Suggested",
                  key: "suggested",
                  width: 240,
                  render: (_, m) =>
                    m.decision ? (
                      <Tag
                        color={m.decision === "approved" ? "green" : undefined}
                      >
                        {m.decision === "approved" ? "Approved" : "Skipped"}
                      </Tag>
                    ) : (
                      <SuggestedLabels message={m} max={2} />
                    ),
                },
                {
                  title: "Received",
                  key: "received",
                  width: 96,
                  render: (_, m) => (
                    <ReceivedCell time={String(m.receivedTime)} />
                  ),
                },
                {
                  title: "",
                  key: "actions",
                  width: 80,
                  render: (_, m) => (
                    <Space size={4}>
                      {!m.decision && (
                        <Tooltip title={"Approve as suggested"}>
                          <Button
                            shape={"circle"}
                            size={"small"}
                            icon={<CheckOutlined />}
                            aria-label={`Approve ${m.subject ?? "message"} as suggested`}
                            onClick={() =>
                              void act(async () => {
                                await approveSuggested([m], options);
                                return "Approved as suggested.";
                              })
                            }
                          />
                        </Tooltip>
                      )}
                      <Tooltip title={"Open message"}>
                        <Button
                          shape={"circle"}
                          size={"small"}
                          icon={<EyeOutlined />}
                          aria-label={`Open ${m.subject ?? "message"}`}
                          onClick={() => setOpened(m)}
                        />
                      </Tooltip>
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </Flex>
      </div>
      <MessageViewer message={opened} onClose={() => setOpened(undefined)} />
      <Drawer
        title={"Mailboxes"}
        open={mailboxesOpen}
        onClose={() => setMailboxesOpen(false)}
        width={480}
      >
        <MailAccountsCard
          accounts={accounts}
          loading={accountsLoading}
          onConnect={connect}
          bare={true}
        />
      </Drawer>
    </>
  );
};

export default MailInboxPage;
