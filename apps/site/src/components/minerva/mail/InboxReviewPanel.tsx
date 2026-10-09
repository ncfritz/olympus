import { CheckOutlined, EyeOutlined, ForwardOutlined } from "@ant-design/icons";
import type {
  MailChangeBatch,
  MailInboxMessage,
  MailLabel,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Checkbox,
  Flex,
  message as toast,
  Progress,
  Space,
  Tooltip,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import React, { useEffect, useMemo, useState } from "react";
import mailApi from "../../../api/mailApi";
import { apiProblems } from "../../../utils/goals";
import {
  type LabelWants,
  pickerOptions,
  RECENT_KEY,
  withRecent,
} from "../../../utils/labelPicker";
import {
  APPROVE_OPTIONS_KEY,
  type ApproveOptions,
  approvalOf,
  DEFAULT_APPROVE_OPTIONS,
  initialWants,
  isAmended,
  parseApproveOptions,
  pickerMessageOf,
  pickerSuggestionsOf,
  confidenceSolid,
  reasonOf,
} from "../../../utils/mailInbox";
import { paymentText } from "../../../utils/mailPayments";
import {
  loadFromLocalStorage,
  storeToLocalStorage,
} from "../../../utils/storage";
import { CurrentLabels } from "./InboxLabels";
import LabelPicker from "./LabelPicker";

const { Text } = Typography;

/** What approving or skipping a message did, for its row. */
export type ReviewOutcome =
  | { kind: "approved"; batch?: MailChangeBatch; labels: string[] }
  | { kind: "skipped" };

export interface InboxReviewPanelProps {
  message: MailInboxMessage;
  /** Every label of the caller's; the message's account's are offered. */
  labels: MailLabel[];
  /**
   * In columns (the Inbox page: Proposed, Current, Changes, the actions
   * under them) or stacked (the home widget).
   */
  columns?: boolean;
  /** Columns only: how far in the table's first data column starts. */
  indent?: number;
  onOpen: (m: MailInboxMessage) => void;
  onDone: (m: MailInboxMessage, outcome: ReviewOutcome) => void;
}

/** Options kept in the browser; read after mounting (no storage server-side). */
export const useApproveOptions = (): [
  ApproveOptions,
  (next: ApproveOptions) => void,
] => {
  const [options, setOptions] = useState<ApproveOptions>(
    DEFAULT_APPROVE_OPTIONS,
  );
  useEffect(() => {
    setOptions(
      parseApproveOptions(
        loadFromLocalStorage<unknown>(APPROVE_OPTIONS_KEY, null),
      ),
    );
  }, []);
  const save = (next: ApproveOptions) => {
    setOptions(next);
    try {
      storeToLocalStorage(APPROVE_OPTIONS_KEY, next);
    } catch {
      // Storage blocked: the choice holds for this visit.
    }
  };
  return [options, save];
};

/** The Inbox's columns: Proposed's label, Current and Changes. */
const PROPOSED_LABEL_WIDTH = 300;
const CONFIDENCE_WIDTH = 80;
const CURRENT_WIDTH = 200;
const CHANGES_WIDTH = 300;
const COLUMN_GAP = 16;
/** Proposed, Current and Changes side by side: the actions end with them. */
const COLUMNS_WIDTH =
  PROPOSED_LABEL_WIDTH +
  8 +
  CONFIDENCE_WIDTH +
  COLUMN_GAP +
  CURRENT_WIDTH +
  COLUMN_GAP +
  CHANGES_WIDTH;

/**
 * A message's review (design.md, the widget's and the Inbox's expanded
 * row): each suggestion with its checkbox, confidence and reason; the
 * label picker; archive, mark read and whole thread; then Open message,
 * Skip and Approve. Archive starts unticked and mark read ticked for each
 * message; whole thread is remembered.
 */
const InboxReviewPanel: React.FunctionComponent<InboxReviewPanelProps> = ({
  message: m,
  labels,
  columns = false,
  indent = 0,
  onOpen,
  onDone,
}) => {
  const [wants, setWants] = useState<LabelWants>(() => initialWants(m));
  const [created, setCreated] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [remembered, remember] = useApproveOptions();
  const [archive, setArchive] = useState(DEFAULT_APPROVE_OPTIONS.archive);
  const [markRead, setMarkRead] = useState(DEFAULT_APPROVE_OPTIONS.markRead);
  const [busy, setBusy] = useState<"approve" | "skip">();
  /** A payment's bill: marked paid with the approval, or declined. */
  const [markPaid, setMarkPaid] = useState(true);
  const [notThisBill, setNotThisBill] = useState(false);
  const payment = notThisBill ? undefined : m.payment;

  useEffect(() => {
    setWants(initialWants(m));
    setCreated([]);
    setMarkPaid(true);
    setNotThisBill(false);
    setArchive(DEFAULT_APPROVE_OPTIONS.archive);
    setMarkRead(DEFAULT_APPROVE_OPTIONS.markRead);
  }, [m.accountId, m.gmailId]);
  useEffect(() => {
    setRecent(loadFromLocalStorage<string[]>(RECENT_KEY, []));
  }, []);

  const offered = useMemo(
    () => pickerOptions(labels.filter((l) => l.accountId === m.accountId)),
    [labels, m.accountId],
  );
  const messages = useMemo(() => [pickerMessageOf(m)], [m]);
  const suggestions = useMemo(() => pickerSuggestionsOf(m), [m]);
  const amended = isAmended(m, wants);

  const toggle = (label: string, on: boolean) => {
    const next = { ...wants };
    if (on) next[label] = "all";
    else delete next[label];
    setWants(next);
  };

  const approve = async () => {
    setBusy("approve");
    try {
      const { approval, newLabels } = approvalOf(m, wants, created);
      const result = (
        await mailApi.approveMessages(m.accountId, {
          messages: [approval],
          archive,
          markRead,
          wholeThread: remembered.wholeThread,
          ...(newLabels.length ? { newLabels } : {}),
        })
      ).data;
      try {
        storeToLocalStorage(RECENT_KEY, withRecent(recent, approval.add));
      } catch {
        // Recent labels are a convenience.
      }
      if (payment && markPaid) {
        try {
          await mailApi.acceptPaymentMatches(m.accountId, [
            {
              confirmationGmailId: payment.confirmationGmailId,
              billGmailId: payment.billGmailId,
            },
          ]);
        } catch (error) {
          toast.error(
            `The bill was not marked: ${apiProblems(error).join(" ")}`,
          );
        }
      }
      onDone(m, {
        kind: "approved",
        ...(result.batch ? { batch: result.batch } : {}),
        labels: [
          ...m.labels.filter((l) => !approval.remove.includes(l)),
          ...approval.add,
        ],
      });
    } catch (error) {
      toast.error(apiProblems(error).join(" "));
    } finally {
      setBusy(undefined);
    }
  };

  /** The payment is not that bill's: the one before is offered next time. */
  const declineBill = async () => {
    if (!m.payment) return;
    try {
      await mailApi.dismissPaymentMatches(m.accountId, [
        {
          confirmationGmailId: m.payment.confirmationGmailId,
          billGmailId: m.payment.billGmailId,
        },
      ]);
      setNotThisBill(true);
    } catch (error) {
      toast.error(apiProblems(error).join(" "));
    }
  };

  const skip = async () => {
    setBusy("skip");
    try {
      await mailApi.skipMessages(m.accountId, [m.gmailId]);
      onDone(m, { kind: "skipped" });
    } catch (error) {
      toast.error(apiProblems(error).join(" "));
    } finally {
      setBusy(undefined);
    }
  };

  const paymentBox = payment && (
    <Flex
      vertical={true}
      gap={4}
      style={{
        border: "1px solid #ffd591",
        background: "#fff7e6",
        borderRadius: 6,
        padding: "6px 10px",
      }}
    >
      <Checkbox
        checked={markPaid}
        onChange={(e) => setMarkPaid(e.target.checked)}
      >
        A payment: {paymentText(payment)}
      </Checkbox>
      <Text type={"secondary"} style={{ fontSize: 12 }}>
        {payment.billFromAddress ? `${payment.billFromAddress} · ` : ""}
        {payment.fromLabel} → {payment.toLabel}
        {payment.billStarred ? "; then set its done star in Gmail" : ""}
        {payment.matchedBy === "learned"
          ? " · found by the classifier, not its wording"
          : ""}{" "}
        <Button
          type={"link"}
          size={"small"}
          style={{ padding: 0, height: "auto" }}
          onClick={() => void declineBill()}
        >
          Not this bill
        </Button>
      </Text>
    </Flex>
  );

  const proposed =
    m.suggestions.length === 0 ? (
      <Text type={"secondary"}>
        {m.scoredTime
          ? "Nothing scored high enough to suggest."
          : "Not scored yet: no model serves this mailbox, or it arrived before scoring began."}
      </Text>
    ) : (
      m.suggestions.map((s) => (
        <Flex key={s.label} align={"center"} gap={8}>
          <Checkbox
            checked={
              s.onMessage ? wants[s.label] !== "none" : wants[s.label] === "all"
            }
            disabled={s.onMessage}
            onChange={(e) => toggle(s.label, e.target.checked)}
            style={columns ? { width: PROPOSED_LABEL_WIDTH, flex: "none" } : {}}
          >
            <Tooltip title={reasonOf(s)}>
              <span style={{ opacity: s.ticked ? 1 : 0.6 }}>
                {s.label}
                {s.onMessage ? <Text type={"secondary"}> · has it</Text> : null}
              </span>
            </Tooltip>
          </Checkbox>
          <Progress
            percent={Math.round(s.score * 100)}
            size={"small"}
            showInfo={true}
            style={{
              width: columns ? CONFIDENCE_WIDTH : 120,
              margin: 0,
              marginInlineStart: columns ? 0 : "auto",
            }}
            strokeColor={
              s.ticked ? confidenceSolid(s.score).background : "#bfbfbf"
            }
          />
        </Flex>
      ))
    );

  const picker = (
    <LabelPicker
      messages={messages}
      options={offered}
      suggestions={suggestions}
      recent={recent}
      wants={wants}
      onChange={setWants}
      created={created}
      onCreated={setCreated}
      stacked={columns}
    />
  );

  const flags = (
    <Space size={16} wrap={!columns}>
      <Checkbox
        checked={archive}
        onChange={(e) => setArchive(e.target.checked)}
      >
        Archive
      </Checkbox>
      <Checkbox
        checked={markRead}
        onChange={(e) => setMarkRead(e.target.checked)}
      >
        Mark read
      </Checkbox>
      <Checkbox
        checked={remembered.wholeThread}
        disabled={m.threadSize < 2}
        onChange={(e) =>
          remember({ ...remembered, wholeThread: e.target.checked })
        }
      >
        Whole thread{m.threadSize > 1 ? ` (${m.threadSize})` : ""}
      </Checkbox>
    </Space>
  );

  const buttons = (
    <Space wrap={true}>
      <Button icon={<EyeOutlined />} onClick={() => onOpen(m)}>
        Open message
      </Button>
      <Button
        icon={<ForwardOutlined />}
        loading={busy === "skip"}
        disabled={busy === "approve"}
        onClick={() => void skip()}
      >
        Skip
      </Button>
      <Button
        type={"primary"}
        icon={<CheckOutlined />}
        loading={busy === "approve"}
        disabled={busy === "skip"}
        onClick={() => void approve()}
      >
        {amended ? "Approve changes" : "Approve & apply"}
      </Button>
    </Space>
  );

  if (columns) {
    const heading = (title: string) => (
      <Text strong={true} style={{ fontSize: 12 }}>
        {title}
      </Text>
    );
    return (
      <Flex
        vertical={true}
        gap={12}
        style={{ padding: `4px 8px 8px ${indent}px` }}
      >
        <Flex gap={COLUMN_GAP} wrap={true} align={"flex-start"}>
          <Flex
            vertical={true}
            gap={8}
            style={{ width: PROPOSED_LABEL_WIDTH + 8 + CONFIDENCE_WIDTH }}
          >
            {heading("Proposed")}
            {paymentBox}
            {proposed}
          </Flex>
          <Flex vertical={true} gap={8} style={{ width: CURRENT_WIDTH }}>
            {heading("Current")}
            <div>
              <CurrentLabels
                labels={m.labels}
                max={m.labels.length}
                block={true}
              />
            </div>
          </Flex>
          <Flex vertical={true} gap={8} style={{ width: CHANGES_WIDTH }}>
            {heading("Changes")}
            {picker}
          </Flex>
        </Flex>
        <Flex
          justify={"flex-end"}
          style={{ width: COLUMNS_WIDTH, maxWidth: "100%" }}
        >
          <Flex vertical={true} align={"flex-start"} gap={8}>
            {flags}
            {buttons}
          </Flex>
        </Flex>
      </Flex>
    );
  }

  return (
    <Space
      direction={"vertical"}
      size={12}
      style={{ width: "100%", padding: 8 }}
    >
      <Text type={"secondary"} style={{ fontSize: 12 }}>
        {m.fromAddress ?? "(no address)"} ·{" "}
        {DateTime.fromISO(String(m.receivedTime)).toLocaleString(
          DateTime.DATETIME_MED,
        )}
        {m.threadSize > 1 ? ` · ${m.threadSize} in thread` : ""}
      </Text>
      {paymentBox}
      {proposed}
      {picker}
      {flags}
      {buttons}
    </Space>
  );
};

export default InboxReviewPanel;
