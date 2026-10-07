import { CheckOutlined, EyeOutlined, ForwardOutlined } from "@ant-design/icons";
import type {
  MailChangeBatch,
  MailInboxMessage,
  MailLabel,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Checkbox,
  Col,
  Flex,
  message as toast,
  Progress,
  Row,
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
  reasonOf,
} from "../../../utils/mailInbox";
import { paymentChange, paymentText } from "../../../utils/mailPayments";
import {
  loadFromLocalStorage,
  storeToLocalStorage,
} from "../../../utils/storage";
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
  /** Side by side (the Inbox page) or stacked (the home widget). */
  columns?: boolean;
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

/**
 * A message's review (design.md, the widget's and the Inbox's expanded
 * row): who and when; each suggestion with its checkbox, confidence and
 * reason; the label picker; archive, mark read and whole thread; then
 * Approve & apply, Skip and Open message.
 */
const InboxReviewPanel: React.FunctionComponent<InboxReviewPanelProps> = ({
  message: m,
  labels,
  columns = false,
  onOpen,
  onDone,
}) => {
  const [wants, setWants] = useState<LabelWants>(() => initialWants(m));
  const [created, setCreated] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [options, setOptions] = useApproveOptions();
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
          archive: options.archive,
          markRead: options.markRead,
          wholeThread: options.wholeThread,
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
          await mailApi.applyChanges(m.accountId, [paymentChange(payment)]);
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

  const about = (
    <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
      <Text type={"secondary"} style={{ fontSize: 12 }}>
        {m.fromAddress ?? "(no address)"} ·{" "}
        {DateTime.fromISO(String(m.receivedTime)).toLocaleString(
          DateTime.DATETIME_MED,
        )}
        {m.threadSize > 1 ? ` · ${m.threadSize} in thread` : ""}
      </Text>
      {payment && (
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
            {payment.billStarred
              ? "; then set its done star in Gmail"
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
      )}
      {m.suggestions.length === 0 ? (
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
                s.onMessage
                  ? wants[s.label] !== "none"
                  : wants[s.label] === "all"
              }
              disabled={s.onMessage}
              onChange={(e) => toggle(s.label, e.target.checked)}
            >
              <Tooltip title={reasonOf(s)}>
                <span style={{ opacity: s.ticked ? 1 : 0.6 }}>
                  {s.label}
                  {s.onMessage ? (
                    <Text type={"secondary"}> · has it</Text>
                  ) : null}
                </span>
              </Tooltip>
            </Checkbox>
            <Progress
              percent={Math.round(s.score * 100)}
              size={"small"}
              showInfo={true}
              style={{ width: 120, margin: 0, marginInlineStart: "auto" }}
              strokeColor={s.ticked ? undefined : "#bfbfbf"}
            />
          </Flex>
        ))
      )}
    </Space>
  );

  const picker = (
    <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
      <LabelPicker
        messages={messages}
        options={offered}
        suggestions={suggestions}
        recent={recent}
        wants={wants}
        onChange={setWants}
        created={created}
        onCreated={setCreated}
      />
      <Space size={16} wrap={true}>
        <Checkbox
          checked={options.archive}
          onChange={(e) =>
            setOptions({ ...options, archive: e.target.checked })
          }
        >
          Archive
        </Checkbox>
        <Checkbox
          checked={options.markRead}
          onChange={(e) =>
            setOptions({ ...options, markRead: e.target.checked })
          }
        >
          Mark read
        </Checkbox>
        <Checkbox
          checked={options.wholeThread}
          disabled={m.threadSize < 2}
          onChange={(e) =>
            setOptions({ ...options, wholeThread: e.target.checked })
          }
        >
          Whole thread
        </Checkbox>
      </Space>
      <Space wrap={true}>
        <Button
          type={"primary"}
          icon={<CheckOutlined />}
          loading={busy === "approve"}
          disabled={busy === "skip"}
          onClick={() => void approve()}
        >
          {amended ? "Approve changes" : "Approve & apply"}
        </Button>
        <Button
          icon={<ForwardOutlined />}
          loading={busy === "skip"}
          disabled={busy === "approve"}
          onClick={() => void skip()}
        >
          Skip
        </Button>
        <Button icon={<EyeOutlined />} onClick={() => onOpen(m)}>
          Open message
        </Button>
      </Space>
    </Space>
  );

  return columns ? (
    <Row gutter={24} style={{ padding: "8px 8px 8px 0" }}>
      <Col xs={24} md={10}>
        {about}
      </Col>
      <Col xs={24} md={14}>
        {picker}
      </Col>
    </Row>
  ) : (
    <Space
      direction={"vertical"}
      size={12}
      style={{ width: "100%", padding: 8 }}
    >
      {about}
      {picker}
    </Space>
  );
};

export default InboxReviewPanel;
