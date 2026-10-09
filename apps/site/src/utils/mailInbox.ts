import type {
  MailInboxApproval,
  MailInboxMessage,
} from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import type { Key } from "react";
import type { MailInboxSort } from "../api/mailApi";
import { hueColors, hueSolid } from "./mailPayments";
import type {
  LabelWants,
  PickerMessage,
  PickerSuggestion,
} from "./labelPicker";

/**
 * The inbox's logic (docs/plans/email-management phase 5 and design.md):
 * what approving a message writes, from its suggestion and the picker,
 * kept apart from the page and the widget so it can be tested.
 */

/** A suggestion this sure is high confidence (Accept all ≥ 90%). */
export const HIGH_CONFIDENCE = 0.9;

/** What approving also does; remembered in the browser. */
export type ApproveOptions = {
  archive: boolean;
  markRead: boolean;
  wholeThread: boolean;
};

export const APPROVE_OPTIONS_KEY = "minerva.mail.approveOptions";

/**
 * What approving does unless changed: mark read, not archive. Only whole
 * thread is remembered; archive and mark read start here for each message.
 */
export const DEFAULT_APPROVE_OPTIONS: ApproveOptions = {
  archive: false,
  markRead: true,
  wholeThread: false,
};

/**
 * Options read back from storage: whole thread as remembered, archive and
 * mark read always their defaults.
 */
export const parseApproveOptions = (value: unknown): ApproveOptions => {
  const o = (value ?? {}) as Partial<Record<keyof ApproveOptions, unknown>>;
  return {
    ...DEFAULT_APPROVE_OPTIONS,
    wholeThread:
      typeof o.wholeThread === "boolean"
        ? o.wholeThread
        : DEFAULT_APPROVE_OPTIONS.wholeThread,
  };
};

/** Where "approved today" begins: this browser's midnight. */
export const startOfToday = (now: DateTime = DateTime.local()): string =>
  now.startOf("day").toUTC().toISO() as string;

/** The ticked suggestions the message does not have yet. */
export const suggestedAdds = (m: MailInboxMessage): string[] =>
  m.suggestions.filter((s) => s.ticked && !s.onMessage).map((s) => s.label);

/** The picker's starting point: the ticked suggestion, to be applied. */
export const initialWants = (m: MailInboxMessage): LabelWants =>
  Object.fromEntries(
    suggestedAdds(m)
      // A payment is not itself a bill: its sender's open state is the
      // bill's, which the payment moves on instead.
      .filter((l) => l !== m.payment?.fromLabel)
      .map((l) => [l, "all" as const]),
  );

export const pickerMessageOf = (m: MailInboxMessage): PickerMessage => ({
  gmailId: m.gmailId,
  accountId: m.accountId,
  labels: m.labels,
});

/** The message's suggestions as the picker lists them first. */
export const pickerSuggestionsOf = (m: MailInboxMessage): PickerSuggestion[] =>
  m.suggestions
    .filter((s) => !s.onMessage)
    .map((s) => ({ label: s.label, messages: 1, confidence: s.score }));

/**
 * What approving one message writes: the labels the picker puts on and
 * takes off, and those of them made in the picker, to create first.
 */
export const approvalOf = (
  m: MailInboxMessage,
  wants: LabelWants,
  created: string[] = [],
): { approval: MailInboxApproval; newLabels: string[] } => {
  const add: string[] = [];
  const remove: string[] = [];
  for (const [label, want] of Object.entries(wants)) {
    const has = m.labels.includes(label);
    if (want === "all" && !has) add.push(label);
    if (want === "none" && has) remove.push(label);
  }
  add.sort();
  remove.sort();
  return {
    approval: { gmailId: m.gmailId, add, remove },
    newLabels: created.filter((c) => add.includes(c)).sort(),
  };
};

/** Whether the picker's labels are other than the ticked suggestion's. */
export const isAmended = (m: MailInboxMessage, wants: LabelWants): boolean => {
  const { approval } = approvalOf(m, wants);
  const suggested = suggestedAdds(m).sort();
  return (
    approval.remove.length > 0 ||
    approval.add.length !== suggested.length ||
    approval.add.some((l, i) => l !== suggested[i])
  );
};

/** Approving as suggested, by account: Accept, and Accept all ≥ 90%. */
export const suggestedApprovals = (
  messages: MailInboxMessage[],
): Map<string, MailInboxApproval[]> => {
  const result = new Map<string, MailInboxApproval[]>();
  for (const m of messages) {
    const approvals = result.get(m.accountId) ?? [];
    approvals.push({ gmailId: m.gmailId, add: suggestedAdds(m), remove: [] });
    result.set(m.accountId, approvals);
  }
  return result;
};

/** Messages' Gmail IDs by account, for skip, archive and mark read. */
export const gmailIdsByAccount = (
  messages: MailInboxMessage[],
): Map<string, string[]> => {
  const result = new Map<string, string[]>();
  for (const m of messages) {
    result.set(m.accountId, [...(result.get(m.accountId) ?? []), m.gmailId]);
  }
  return result;
};

/** Pieces of at most `size`, in order. */
export const chunked = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

/** Why a label is suggested, for its line in the review panel. */
export const reasonOf = (s: { score: number; ticked: boolean }): string =>
  `The classifier is ${Math.round(s.score * 100)}% sure${
    s.ticked ? "" : ": below the label's threshold, so not ticked"
  }`;

/** The sender as a row shows it. */
export const senderOf = (m: {
  fromName?: string;
  fromAddress?: string;
}): string => m.fromName ?? m.fromAddress ?? "(no sender)";

/**
 * Gmail's flags as the change log shows them: archiving and marking read
 * (INBOX and UNREAD taken off), or their undoing. Undefined for a label.
 */
export const flagChangeText = (
  action: "add" | "remove",
  label: string,
): string | undefined => {
  if (label === "INBOX") {
    return action === "remove" ? "Archived" : "Back in the inbox";
  }
  if (label === "UNREAD") {
    return action === "remove" ? "Marked read" : "Marked unread";
  }
  if (label === "STARRED") {
    return action === "add" ? "Starred" : "Unstarred";
  }
  return undefined;
};

/** A refresh would take the frame to another page: removed. */
const REFRESH = /<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh[^>]*>/gi;

/** An image proxy's address as a policy source: an http(s) URL ending in /. */
const PROXY_SOURCE = /^https?:\/\/[^\s;,'"]+\/$/;

/**
 * The HTML of a message as the viewer's frame shows it: no script runs
 * (the frame's sandbox), nothing remote loads (this policy) but images
 * through the API's proxy (`imageProxy`, GetMailMessageContent's, which
 * the HTML's remote images were rewritten to), it cannot send itself
 * elsewhere (a refresh is removed), and links open in a new tab.
 */
export const containedHtml = (html: string, imageProxy?: string): string => {
  const images =
    imageProxy && PROXY_SOURCE.test(imageProxy)
      ? `img-src data: ${imageProxy}`
      : "img-src data:";
  return [
    "<!doctype html><html><head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${images}; style-src 'unsafe-inline'; font-src data:; form-action 'none'">`,
    '<base target="_blank">',
    "<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;margin:12px;color:#1f1f1f;word-wrap:break-word}img{max-width:100%}</style>",
    "</head><body>",
    html.replace(REFRESH, ""),
    "</body></html>",
  ].join("");
};

/**
 * The message to open once `current` is reviewed: the next in the list
 * still undecided, or none at the end.
 */
export const nextToReview = (
  messages: MailInboxMessage[],
  current: MailInboxMessage,
): MailInboxMessage | undefined => {
  const at = messages.findIndex(
    (m) => m.accountId === current.accountId && m.gmailId === current.gmailId,
  );
  return at < 0 ? undefined : messages.slice(at + 1).find((m) => !m.decision);
};

/** The columns the inbox sorts by. */
const INBOX_SORTS: MailInboxSort[] = [
  "receivedTime",
  "confidence",
  "from",
  "subject",
];

/** The inbox's order: a sortable column and its direction. */
export type InboxOrder = { sortBy: MailInboxSort; sort?: "asc" | "desc" };

/** The inbox's order when no column is chosen: newest first. */
export const DEFAULT_ORDER: InboxOrder = { sortBy: "receivedTime" };

/**
 * A column's arrow for the inbox's order: the received column points down
 * by default, as that is the order the API gives with no direction.
 */
export const sortOrderOf = (
  order: InboxOrder,
  column: MailInboxSort,
): "ascend" | "descend" | null => {
  if (order.sortBy !== column) return null;
  if (order.sort === "asc") return "ascend";
  return order.sort === "desc" || column === "receivedTime" ? "descend" : null;
};

/** The inbox's order from the table's sorter; the default with none. */
export const orderOf = (sorter: {
  columnKey?: Key;
  order?: "ascend" | "descend" | null;
}): InboxOrder => {
  const sortBy = INBOX_SORTS.find((s) => s === sorter.columnKey);
  if (!sortBy || !sorter.order) return DEFAULT_ORDER;
  return { sortBy, sort: sorter.order === "ascend" ? "asc" : "desc" };
};

/** A confidence as the inbox shows it: a whole percent, or a dash. */
export const confidenceText = (score?: number): string =>
  score === undefined || score === null ? "—" : `${Math.round(score * 100)}%`;

/** Where a confidence turns: red to 50%, yellow at 80%, green from 95%. */
export const CONFIDENCE_RED = 0.5;
export const CONFIDENCE_YELLOW = 0.8;
export const CONFIDENCE_GREEN = 0.95;

/**
 * A confidence's hue on the bills' green, yellow, red scale: red up to
 * 50%, yellow at 80% (the filter's lowest floor), green from 95%.
 */
export const confidenceHue = (score: number): number =>
  score <= CONFIDENCE_RED
    ? 0
    : score <= CONFIDENCE_YELLOW
      ? (60 * (score - CONFIDENCE_RED)) / (CONFIDENCE_YELLOW - CONFIDENCE_RED)
      : score < CONFIDENCE_GREEN
        ? 60 +
          (60 * (score - CONFIDENCE_YELLOW)) /
            (CONFIDENCE_GREEN - CONFIDENCE_YELLOW)
        : 120;

/** A confidence cell's colours, as the bills' Open column; none unscored. */
export const confidenceColors = (
  score?: number | null,
): { background: string; color: string } | undefined =>
  score === undefined || score === null
    ? undefined
    : hueColors(confidenceHue(score));

/** A confidence badge's colours: the same hue, solid. */
export const confidenceSolid = (
  score: number,
): { background: string; color: string } => hueSolid(confidenceHue(score));

/** The confidence column's filter: its one chosen floor, else none. */
export const minConfidenceOf = (
  values?: readonly unknown[] | null,
): number | undefined => {
  const v = Number(values?.[0]);
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

/** A text column's filter: its term, trimmed, else none. */
export const textFilterOf = (
  values?: readonly unknown[] | null,
): string | undefined => {
  const v = values?.[0];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};
