import {
  CheckOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  ThunderboltOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import type {
  ListMailInboxResponse,
  MailInboxMessage,
  MailInboxStatus,
  MailLabel,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Badge,
  Button,
  message,
  Popconfirm,
  Skeleton,
  Tabs,
  type TabsProps,
  Tag,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useState } from "react";
import mailApi from "../../../api/mailApi";
import { useAuth } from "../../../auth/AuthProvider";
import InboxReviewPanel, {
  type ReviewOutcome,
  useApproveOptions,
} from "../../minerva/mail/InboxReviewPanel";
import { SuggestedLabels } from "../../minerva/mail/InboxLabels";
import {
  approveSuggested,
  highConfidenceToReview,
} from "../../minerva/mail/inboxActions";
import MessageViewer from "../../minerva/mail/MessageViewer";
import { apiProblems } from "../../../utils/goals";
import { senderOf, startOfToday } from "../../../utils/mailInbox";
import {
  loadFromLocalStorage,
  storeToLocalStorage,
} from "../../../utils/storage";
import styles from "./MailWidget.module.css";

type TabKey = Extract<MailInboxStatus, "review" | "unread" | "approved">;

const TABS: { key: TabKey; label: string; empty: string }[] = [
  { key: "review", label: "To review", empty: "Nothing to review." },
  { key: "unread", label: "Unread", empty: "Nothing unread in the inbox." },
  { key: "approved", label: "Approved", empty: "Nothing approved today." },
];

const TAB_KEY = "mail.widget.tab";
const LIMIT = 10;
const RELOAD_MS = 2 * 60 * 1000;
const INBOX = "/minerva/mail";
/**
 * Where a row's text starts: its padding (8), the caret (24), the gaps
 * (10 each) and the unread dot (8); the review lines up with it, as the
 * Inbox's lines up with the sender.
 */
const TEXT_INDENT = 8 + 24 + 10 + 8 + 10;

const key = (m: MailInboxMessage) => `${m.accountId}/${m.gmailId}`;

/**
 * The home page's mail (docs/plans/email-management phase 5; design.md):
 * what is to review, unread and approved today, ten at a time. A row
 * expands in place, one at a time, into the review panel; approving folds
 * the labels into the row, marks it approved and offers Undo.
 */
const MailWidget: React.FunctionComponent = () => {
  const auth = useAuth();
  if (auth.status !== "signed-in") {
    return (
      <Frame
        body={() =>
          auth.status === "loading" ? (
            <Loading />
          ) : (
            <div className={styles.state}>Sign in to see your mail.</div>
          )
        }
      />
    );
  }
  return <SignedInMail />;
};

/** A row approved here: what it now has, and the batch to undo. */
type Folded = { labels: string[]; batchId?: string; undone?: boolean };

const SignedInMail = () => {
  const [tab, setTab] = useState<TabKey>("review");
  useEffect(() => {
    const stored = loadFromLocalStorage<unknown>(TAB_KEY, "review");
    if (TABS.some((t) => t.key === stored)) setTab(stored as TabKey);
  }, []);
  const choose = (next: TabKey) => {
    setTab(next);
    setOpen(undefined);
    try {
      storeToLocalStorage(TAB_KEY, next);
    } catch {
      // The tab is remembered only when storage allows.
    }
  };

  const [data, setData] = useState<ListMailInboxResponse>();
  const [failed, setFailed] = useState(false);
  const [labels, setLabels] = useState<MailLabel[]>([]);
  const [open, setOpen] = useState<string>();
  const [folded, setFolded] = useState<Record<string, Folded>>({});
  const [opened, setOpened] = useState<MailInboxMessage>();
  const [busy, setBusy] = useState<string>();
  const [options] = useApproveOptions();

  const load = useCallback(async () => {
    try {
      setData(
        (
          await mailApi.listInbox({
            status: tab,
            approvedSince: startOfToday(),
            pageSize: LIMIT,
            startPage: 0,
          })
        ).data,
      );
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [tab]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), RELOAD_MS);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    mailApi
      .listLabels()
      .then((r) => setLabels(r.data.labels))
      .catch(() => setLabels([]));
  }, []);

  const fold = (m: MailInboxMessage, outcome: ReviewOutcome) => {
    setOpen(undefined);
    if (outcome.kind === "approved") {
      setFolded((f) => ({
        ...f,
        [key(m)]: {
          labels: outcome.labels,
          ...(outcome.batch ? { batchId: outcome.batch.id } : {}),
        },
      }));
    } else {
      message.success("Skipped");
      void load();
    }
  };

  const accept = async (m: MailInboxMessage) => {
    setBusy(key(m));
    try {
      const done = await approveSuggested([m], options);
      fold(m, {
        kind: "approved",
        ...(done.batches[0] ? { batch: done.batches[0] } : {}),
        labels: [
          ...m.labels,
          ...m.suggestions
            .filter((s) => s.ticked && !s.onMessage)
            .map((s) => s.label),
        ],
      });
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(undefined);
    }
  };

  const undo = async (m: MailInboxMessage, batchId: string) => {
    try {
      await mailApi.undoChangeBatch(batchId);
      setFolded((f) => ({ ...f, [key(m)]: { ...f[key(m)], undone: true } }));
      message.success("Undoing in Gmail");
      setTimeout(() => void load(), 5000);
    } catch (error) {
      message.error(
        `${apiProblems(error).join(" ")} You can undo it from the change log once it is written.`,
      );
    }
  };

  const acceptAll = async () => {
    setBusy("all");
    try {
      const found = await highConfidenceToReview();
      const done = await approveSuggested(found, options);
      message.success(`Approved ${done.messages} as suggested`);
      await load();
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(undefined);
    }
  };

  const count = (k: TabKey): number | undefined => {
    const s = data?.summary;
    if (!s) return undefined;
    return { review: s.toReview, unread: s.unread, approved: s.approved }[k];
  };

  const body = (k: TabKey) => {
    const meta = TABS.find((t) => t.key === k)!;
    if (failed && !data) {
      return (
        <div className={styles.state}>
          Your mail could not be loaded.
          <Button size={"small"} onClick={() => void load()}>
            Retry
          </Button>
        </div>
      );
    }
    if (!data) return <Loading />;
    const rows = data.messages;
    const high = data.summary.highConfidence;
    return (
      <>
        <div className={styles.lead}>
          <span>{DateTime.local().toFormat("ccc LLL d")}</span>
          {k === "review" && high > 0 && (
            <Popconfirm
              title={`Accept all ${high} at 90% or more?`}
              description={
                "Each gets its ticked suggestion in Gmail; undo from the change log."
              }
              okText={"Accept all"}
              onConfirm={() => void acceptAll()}
            >
              <Button
                size={"small"}
                type={"link"}
                icon={<ThunderboltOutlined />}
                loading={busy === "all"}
              >
                Accept all ≥ 90%
              </Button>
            </Popconfirm>
          )}
        </div>
        {rows.length === 0 && <div className={styles.state}>{meta.empty}</div>}
        {rows.map((m) => {
          const k2 = key(m);
          const done = folded[k2];
          const expanded = open === k2;
          const received = DateTime.fromISO(String(m.receivedTime));
          return (
            <React.Fragment key={k2}>
              <div className={styles.row}>
                {!done && !m.decision ? (
                  <Button
                    type={"text"}
                    size={"small"}
                    className={styles.caret}
                    icon={
                      expanded ? <CaretDownOutlined /> : <CaretRightOutlined />
                    }
                    aria-label={
                      expanded ? "Close the review" : "Review this message"
                    }
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? undefined : k2)}
                  />
                ) : (
                  <span className={styles.caret} />
                )}
                <span
                  className={`${styles.dot} ${m.unread && !done ? styles.unread : ""}`}
                />
                <span className={styles.text}>
                  <span className={styles.top}>
                    <span
                      className={`${styles.sender} ${m.unread ? styles.bold : ""}`}
                    >
                      {senderOf(m)}
                    </span>
                    <span className={styles.date}>
                      {received.hasSame(DateTime.local(), "day")
                        ? received.toLocaleString(DateTime.TIME_SIMPLE)
                        : received.toFormat("LLL d")}
                    </span>
                  </span>
                  <span className={styles.subject}>
                    {m.subject ?? "(no subject)"}
                  </span>
                  <span className={styles.labels}>
                    {done ? (
                      <>
                        {done.labels.map((l) => (
                          <Tag
                            key={l}
                            color={"green"}
                            style={{ marginInlineEnd: 2 }}
                          >
                            {l}
                          </Tag>
                        ))}
                        <span className={styles.approved}>
                          {done.undone ? "Undone" : "Approved"}
                        </span>
                        {done.batchId && !done.undone && (
                          <Button
                            size={"small"}
                            type={"link"}
                            icon={<UndoOutlined />}
                            onClick={() => void undo(m, done.batchId!)}
                          >
                            Undo
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        {m.labels.slice(0, 2).map((l) => (
                          <Tag key={l} style={{ marginInlineEnd: 2 }}>
                            {l}
                          </Tag>
                        ))}
                        {k === "review" && (
                          <>
                            <span>→</span>
                            <SuggestedLabels message={m} max={2} />
                          </>
                        )}
                      </>
                    )}
                  </span>
                </span>
                {k === "review" && !done && (
                  <Button
                    shape={"circle"}
                    icon={<CheckOutlined />}
                    loading={busy === k2}
                    aria-label={`Approve ${m.subject ?? "message"} as suggested`}
                    onClick={() => void accept(m)}
                    style={{ color: "#6b6b6b" }}
                  />
                )}
              </div>
              {expanded && (
                <div className={styles.panel}>
                  <InboxReviewPanel
                    message={m}
                    labels={labels}
                    columns={true}
                    indent={TEXT_INDENT}
                    onOpen={setOpened}
                    onDone={fold}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
        <div className={styles.foot}>
          <Link href={INBOX}>
            {(count(k) ?? 0) > rows.length
              ? `${(count(k) ?? 0) - rows.length} more in Mail`
              : "Go to Mail"}
          </Link>
        </div>
        <MessageViewer message={opened} onClose={() => setOpened(undefined)} />
      </>
    );
  };

  return <Frame tab={tab} onChange={choose} count={count} body={body} />;
};

const Frame = ({
  tab = "review",
  onChange,
  count,
  body,
}: {
  tab?: TabKey;
  onChange?: (tab: TabKey) => void;
  count?: (tab: TabKey) => number | undefined;
  body: (tab: TabKey) => React.ReactNode;
}) => {
  const router = useRouter();
  const items: TabsProps["items"] = TABS.map((t) => {
    const n = count?.(t.key);
    return {
      key: t.key,
      label: (
        <span>
          {t.label}
          {n !== undefined && (
            <Badge
              count={n}
              showZero={true}
              overflowCount={999}
              size={"small"}
              color={t.key === tab ? "#e6f4ff" : "#f0f0f0"}
              style={{
                marginLeft: 6,
                color: t.key === tab ? "#0958d9" : "#595959",
              }}
            />
          )}
        </span>
      ),
      children: body(t.key),
    };
  });
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Mail</h2>
        <Button
          type={"text"}
          size={"small"}
          onClick={() => void router.push(INBOX)}
        >
          Go to Mail
        </Button>
      </div>
      <Tabs
        id={"mail"}
        className={styles.tabs}
        activeKey={tab}
        items={items}
        onChange={(k) => onChange?.(k as TabKey)}
        destroyOnHidden={true}
      />
    </div>
  );
};

const Loading = () => (
  <div className={styles.skeleton}>
    <Skeleton active={true} paragraph={{ rows: 3 }} title={false} />
  </div>
);

export default MailWidget;
