import {
  MailAuditAction,
  MailAuditChange,
  MailAuditLabel,
  MailAuditMerge,
  MailAuditMergeReason,
  MailAuditRule,
  MailAuditRun,
  MailAuditSummary,
  MailAuditThread,
  MailAuditThreadLabelSet,
  MailThreadMessage,
  MailStarAge,
  MailStarAgeCount,
  MailStarLabel,
  MailStarMixed,
  MailStarSender,
  MailDecision,
} from "@ncfritz/olympus-model";
import moment from "moment";

/*
 * The audit's rows as Hasura returns them (custom column names). Counts
 * from SQL functions are bigint, which Hasura may send as numbers or
 * strings; confidences and overlaps are numeric, sent the same way.
 */
type Count = number | string;

const at = (time: string | null | undefined) =>
  time ? moment(time) : undefined;

export type GraphQlMailAuditRun = {
  id: string;
  accountId: string;
  startedTime: string;
  finishedTime: string;
  messagesExamined: number;
  sendersExamined: number;
  consistentSenders: number;
};

export const toRun = (input: GraphQlMailAuditRun): MailAuditRun => ({
  id: input.id,
  accountId: input.accountId,
  startedTime: moment(input.startedTime),
  finishedTime: moment(input.finishedTime),
  messagesExamined: input.messagesExamined,
  sendersExamined: input.sendersExamined,
  consistentSenders: input.consistentSenders,
});

export type GraphQlMailAuditSummary = {
  startedTime: string;
  finishedTime: string;
  messagesExamined: Count;
  consistentSenders: Count;
  changes: Count;
  additions: Count;
  removals: Count;
  highConfidence: Count;
  messagesAffected: Count;
  merges: Count;
  threads: Count;
  classifierFinishedTime: string | null;
  classifierChanges: Count;
  processed?: Count;
};

export const toSummary = (
  input: GraphQlMailAuditSummary,
): MailAuditSummary => ({
  startedTime: moment(input.startedTime),
  finishedTime: moment(input.finishedTime),
  messagesExamined: Number(input.messagesExamined),
  consistentSenders: Number(input.consistentSenders),
  changes: Number(input.changes),
  additions: Number(input.additions),
  removals: Number(input.removals),
  highConfidence: Number(input.highConfidence),
  messagesAffected: Number(input.messagesAffected),
  merges: Number(input.merges),
  threads: Number(input.threads),
  ...(input.classifierFinishedTime
    ? { classifierFinishedTime: moment(input.classifierFinishedTime) }
    : {}),
  classifierChanges: Number(input.classifierChanges ?? 0),
  processed: Number(input.processed ?? 0),
});

export type GraphQlMailAuditLabel = {
  name: string;
  messages: Count;
  lastReceivedTime: string | null;
  proposedIn: Count;
  proposedOut: Count;
  highConfidence: Count;
  mergeCandidate: boolean;
  processed?: Count;
};

export const toLabel = (input: GraphQlMailAuditLabel): MailAuditLabel => {
  const last = at(input.lastReceivedTime);
  return {
    name: input.name,
    messages: Number(input.messages),
    ...(last ? { lastReceivedTime: last } : {}),
    proposedIn: Number(input.proposedIn),
    proposedOut: Number(input.proposedOut),
    highConfidence: Number(input.highConfidence),
    mergeCandidate: input.mergeCandidate,
    processed: Number(input.processed ?? 0),
  };
};

export type GraphQlMailAuditMerge = {
  reason: string;
  sharedSenders: number;
  fromSenders: number;
  senderOverlap: Count;
  fromMessages: number;
  intoMessages: number;
  fromLastReceivedTime: string | null;
  intoLastReceivedTime: string | null;
  fromLabel: { name: string };
  intoLabel: { name: string };
};

export const toMerge = (input: GraphQlMailAuditMerge): MailAuditMerge => {
  const fromLast = at(input.fromLastReceivedTime);
  const intoLast = at(input.intoLastReceivedTime);
  return {
    fromLabel: input.fromLabel.name,
    intoLabel: input.intoLabel.name,
    reason: input.reason as MailAuditMergeReason,
    sharedSenders: input.sharedSenders,
    fromSenders: input.fromSenders,
    senderOverlap: Number(input.senderOverlap),
    fromMessages: input.fromMessages,
    intoMessages: input.intoMessages,
    ...(fromLast ? { fromLastReceivedTime: fromLast } : {}),
    ...(intoLast ? { intoLastReceivedTime: intoLast } : {}),
  };
};

export type GraphQlMailAuditThread = {
  threadId: string;
  messages: number;
  labelSets: number;
  lastReceivedTime: string;
  run: { accountId: string };
};

/** A row of mail_thread_label_sets: one label of one set, or a set of none. */
export type GraphQlMailThreadLabelSet = {
  accountId: string;
  threadId: string;
  setKey: string;
  messages: number;
  label: string | null;
};

/** Where a thread's sets are kept: its account and its Gmail ID. */
export const threadKey = (accountId: string, threadId: string): string =>
  `${accountId}/${threadId}`;

/**
 * Threads' label sets from the view's rows, by threadKey: each set's
 * labels A to Z, the sets most messages first.
 */
export const toThreadSets = (
  rows: GraphQlMailThreadLabelSet[],
): Map<string, MailAuditThreadLabelSet[]> => {
  const byThread = new Map<string, Map<string, MailAuditThreadLabelSet>>();
  for (const r of rows) {
    const key = threadKey(r.accountId, r.threadId);
    const sets =
      byThread.get(key) ?? new Map<string, MailAuditThreadLabelSet>();
    byThread.set(key, sets);
    const set = sets.get(r.setKey) ?? { labels: [], messages: r.messages };
    sets.set(r.setKey, set);
    if (r.label !== null) set.labels.push(r.label);
  }
  return new Map(
    [...byThread].map(([key, sets]) => [
      key,
      [...sets.values()]
        .map((s) => ({ ...s, labels: [...s.labels].sort() }))
        .sort(
          (a, b) =>
            b.messages - a.messages ||
            a.labels.join("\u0000").localeCompare(b.labels.join("\u0000")),
        ),
    ]),
  );
};

export const toThread = (
  input: GraphQlMailAuditThread,
  sets: MailAuditThreadLabelSet[] = [],
): MailAuditThread => ({
  accountId: input.run.accountId,
  threadId: input.threadId,
  messages: input.messages,
  labelSets: input.labelSets,
  sets,
  lastReceivedTime: moment(input.lastReceivedTime),
});

/** A message of a thread, as mail_messages gives it. */
export type GraphQlMailThreadMessage = {
  gmailId: string;
  fromAddress: string | null;
  fromName: string | null;
  subject: string | null;
  receivedTime: string;
  messageLabels: { label: { name: string; type: string } }[];
};

export const toThreadMessage = (
  input: GraphQlMailThreadMessage,
): MailThreadMessage => ({
  gmailId: input.gmailId,
  ...(input.fromAddress ? { fromAddress: input.fromAddress } : {}),
  ...(input.fromName ? { fromName: input.fromName } : {}),
  ...(input.subject ? { subject: input.subject } : {}),
  receivedTime: moment(input.receivedTime),
  labels: input.messageLabels
    .filter((l) => l.label.type === "user")
    .map((l) => l.label.name)
    .sort(),
});

export type GraphQlMailStarLabel = {
  name: string;
  messages: Count;
  starred: Count;
};
export const toStarLabel = (input: GraphQlMailStarLabel): MailStarLabel => ({
  name: input.name,
  messages: Number(input.messages),
  starred: Number(input.starred),
});

export type GraphQlMailStarSender = {
  address: string;
  messages: Count;
  starred: Count;
};
export const toStarSender = (input: GraphQlMailStarSender): MailStarSender => ({
  address: input.address,
  messages: Number(input.messages),
  starred: Number(input.starred),
});

export type GraphQlMailStarAge = { age: string; starred: Count };
export const toStarAge = (input: GraphQlMailStarAge): MailStarAgeCount => ({
  age: input.age as MailStarAge,
  starred: Number(input.starred),
});

export type GraphQlMailStarMixed = {
  address: string;
  subjectPattern: string;
  messages: Count;
  starred: Count;
  lastReceivedTime: string;
};
export const toStarMixed = (input: GraphQlMailStarMixed): MailStarMixed => ({
  address: input.address,
  subjectPattern: input.subjectPattern,
  messages: Number(input.messages),
  starred: Number(input.starred),
  lastReceivedTime: moment(input.lastReceivedTime),
});

export type GraphQlMailAuditChange = {
  action: string;
  rule: string;
  confidence: Count;
  // The sender rule's evidence, or the classifier's ticked: the other is null.
  senderMessages: number | null;
  senderLabelMessages: number | null;
  ticked: boolean | null;
  decision?: string | null;
  label: { name: string };
  message: {
    accountId: string;
    gmailId: string;
    threadId: string;
    receivedTime: string;
    fromAddress: string | null;
    fromName: string | null;
    subject: string | null;
    messageLabels: { label: { name: string; type: string } }[];
  };
};

export const toChange = (input: GraphQlMailAuditChange): MailAuditChange => {
  const m = input.message;
  return {
    message: {
      accountId: m.accountId,
      gmailId: m.gmailId,
      threadId: m.threadId,
      receivedTime: moment(m.receivedTime),
      ...(m.fromAddress ? { fromAddress: m.fromAddress } : {}),
      ...(m.fromName ? { fromName: m.fromName } : {}),
      ...(m.subject ? { subject: m.subject } : {}),
      labels: m.messageLabels
        .filter((ml) => ml.label.type === "user")
        .map((ml) => ml.label.name)
        .sort(),
    },
    label: input.label.name,
    action: input.action as MailAuditAction,
    rule: input.rule as MailAuditRule,
    confidence: Number(input.confidence),
    ...(input.senderMessages !== null
      ? { senderMessages: input.senderMessages }
      : {}),
    ...(input.senderLabelMessages !== null
      ? { senderLabelMessages: input.senderLabelMessages }
      : {}),
    ...(input.ticked !== null ? { ticked: input.ticked } : {}),
    ...(input.decision ? { decision: input.decision as MailDecision } : {}),
  };
};
