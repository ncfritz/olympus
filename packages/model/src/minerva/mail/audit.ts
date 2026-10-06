import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** What a proposed label change does. */
export enum MailAuditAction {
  /** Put the label on the message. */
  Add = "add",
  /** Take the label off the message. */
  Remove = "remove",
}

/**
 * What proposed a change: an audit rule (docs/plans/email-management phase
 * 2), or the classifier over the whole mailbox (phase 4).
 */
export enum MailAuditRule {
  /** The sender's own habit: the label its mail usually has, or seldom has. */
  Sender = "sender",
  /** The classifier, confidently disagreeing with the message's labels. */
  Classifier = "classifier",
}

/** Why two labels are proposed as one. */
export enum MailAuditMergeReason {
  /** A top-level label and another with the same last segment. */
  SameLeaf = "same_leaf",
  /** Most of the smaller label's senders are also the larger's. */
  SenderOverlap = "sender_overlap",
}

/** What was decided about a proposal. */
export enum MailDecision {
  /** Written to Gmail by a batch. */
  Applied = "applied",
  /** Processed without change. */
  Dismissed = "dismissed",
}

/** How old starred messages are. */
export enum MailStarAge {
  /** Received in the last month. */
  Month = "month",
  /** Received in the last year, but not the last month. */
  Year = "year",
  /** Received more than a year ago. */
  Older = "older",
}

/** What a page of proposed changes is ordered by. */
export enum MailAuditChangeSort {
  /** The change's confidence. */
  Confidence = "confidence",
  /** When the message was received. */
  ReceivedTime = "receivedTime",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
/** One audit of one mail account; a new run replaces the last. */
export class MailAuditRun {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the run",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The mail account audited",
  })
  accountId: string;

  @ApiTimestamp({
    required: true,
    description: "When the run started",
  })
  startedTime: Moment;

  @ApiTimestamp({
    required: true,
    description: "When the run finished",
  })
  finishedTime: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Received messages with a sender, examined",
  })
  messagesExamined: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Senders with enough mail to judge",
  })
  sendersExamined: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Senders with one usual label",
  })
  consistentSenders: number;
}

/** The latest audit's totals over the caller's accounts. */
export class MailAuditSummary {
  @ApiTimestamp({
    required: true,
    description: "When the earliest of the runs started",
  })
  startedTime: Moment;

  @ApiTimestamp({
    required: true,
    description: "When the latest of the runs finished",
  })
  finishedTime: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Received messages with a sender, examined",
  })
  messagesExamined: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Senders with one usual label",
  })
  consistentSenders: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Label changes proposed",
  })
  changes: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Labels proposed for adding",
  })
  additions: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Labels proposed for removing",
  })
  removals: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Changes at or above the high-confidence threshold",
  })
  highConfidence: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages with at least one proposed change",
  })
  messagesAffected: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Merge candidates",
  })
  merges: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Threads whose messages disagree on their labels",
  })
  threads: number;

  @ApiTimestamp({
    required: false,
    description: "When the classifier's suggestions were last published",
  })
  classifierFinishedTime?: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Of the changes, those the classifier proposed",
  })
  classifierChanges: number;
}

/** A user label with its messages and the latest audit's proposals into and out of it. */
export class MailAuditLabel {
  @ApiProperty({
    type: String,
    required: true,
    description: "The label's full name, as Gmail shows it",
  })
  name: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages with the label",
  })
  messages: number;

  @ApiTimestamp({
    required: false,
    description:
      "When its latest message was received; absent when it has none",
  })
  lastReceivedTime?: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages proposed to gain the label",
  })
  proposedIn: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages proposed to lose the label",
  })
  proposedOut: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Of those, the changes at or above the high-confidence threshold",
  })
  highConfidence: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the label is in a merge candidate",
  })
  mergeCandidate: boolean;
}

/** Two labels the audit proposes as one, the smaller into the larger. */
export class MailAuditMerge {
  @ApiProperty({
    type: String,
    required: true,
    description: "The label to merge away",
  })
  fromLabel: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The label to merge it into",
  })
  intoLabel: string;

  @ApiProperty({
    enum: () => MailAuditMergeReason,
    enumName: "MailAuditMergeReason",
    enumSchema: { description: "Why two labels are proposed as one" },
    required: true,
    description: "Why the two are proposed as one",
  })
  reason: MailAuditMergeReason;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Senders the two have in common",
  })
  sharedSenders: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The merged label's senders (with two messages or more under it)",
  })
  fromSenders: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The share of the merged label's senders in common, 0 to 1",
  })
  senderOverlap: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The merged label's messages",
  })
  fromMessages: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The other label's messages",
  })
  intoMessages: number;

  @ApiTimestamp({
    required: false,
    description: "When the merged label's latest message was received",
  })
  fromLastReceivedTime?: Moment;

  @ApiTimestamp({
    required: false,
    description: "When the other label's latest message was received",
  })
  intoLastReceivedTime?: Moment;
}

/** A thread whose messages carry different sets of user labels. */
export class MailAuditThread {
  @ApiProperty({
    type: String,
    required: true,
    description: "The thread's Gmail ID, hexadecimal",
  })
  threadId: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages in the thread",
  })
  messages: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Different sets of user labels among them",
  })
  labelSets: number;

  @ApiTimestamp({
    required: true,
    description: "When its latest message was received",
  })
  lastReceivedTime: Moment;
}

/** A user label and how many of its messages are starred. */
export class MailStarLabel {
  @ApiProperty({
    type: String,
    required: true,
    description: "The label",
  })
  name: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages with the label",
  })
  messages: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Of those, starred",
  })
  starred: number;
}

/** A sender and how many of its messages are starred. */
export class MailStarSender {
  @ApiProperty({
    type: String,
    required: true,
    description: "The sender",
  })
  address: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages from the sender",
  })
  messages: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Of those, starred",
  })
  starred: number;
}

/** How many starred messages are of an age. */
export class MailStarAgeCount {
  @ApiProperty({
    enum: () => MailStarAge,
    enumName: "MailStarAge",
    enumSchema: { description: "How old starred messages are" },
    required: true,
    description: "How old the messages are",
  })
  age: MailStarAge;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Starred messages of that age",
  })
  starred: number;
}

/** Near-identical mail from one sender, starred and not: subjects that match once digits are set aside. */
export class MailStarMixed {
  @ApiProperty({
    type: String,
    required: true,
    description: "The sender",
  })
  address: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The subject, lower case, digits as #",
  })
  subjectPattern: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages with that subject",
  })
  messages: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Of those, starred",
  })
  starred: number;

  @ApiTimestamp({
    required: true,
    description: "When the latest was received",
  })
  lastReceivedTime: Moment;
}

/** Stars over the caller's mail. Takeout records no star icon, so these count stars of any kind until the account is linked. */
export class MailStarStatistics {
  @ApiProperty({
    type: () => MailStarLabel,
    isArray: true,
    required: true,
    description: "The labels with the most starred mail",
  })
  labels: MailStarLabel[];

  @ApiProperty({
    type: () => MailStarSender,
    isArray: true,
    required: true,
    description: "The senders with the most starred mail",
  })
  senders: MailStarSender[];

  @ApiProperty({
    type: () => MailStarAgeCount,
    isArray: true,
    required: true,
    description: "Starred messages by age, newest first",
  })
  ages: MailStarAgeCount[];

  @ApiProperty({
    type: () => MailStarMixed,
    isArray: true,
    required: true,
    description:
      "Near-identical mail starred and not, the largest groups first",
  })
  mixed: MailStarMixed[];
}

/** The message a proposed change is for: its metadata, never its text. */
export class MailAuditMessage {
  @ApiProperty({
    type: String,
    required: true,
    description: "The mail account the message is in",
  })
  accountId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The message's Gmail ID, hexadecimal",
  })
  gmailId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its thread's Gmail ID",
  })
  threadId: string;

  @ApiTimestamp({
    required: true,
    description: "When it was received",
  })
  receivedTime: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description: "The sender's address",
  })
  fromAddress?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The sender's display name",
  })
  fromName?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The subject",
  })
  subject?: string;

  @ApiProperty({
    type: [String],
    required: true,
    description: "Its user labels now, by full name",
  })
  labels: string[];
}

/** A proposed change: one label added to or removed from one message, by a rule, with its evidence. */
export class MailAuditChange {
  @ApiProperty({
    type: () => MailAuditMessage,
    required: true,
    description: "The message",
  })
  message: MailAuditMessage;

  @ApiProperty({
    type: String,
    required: true,
    description: "The label added or removed",
  })
  label: string;

  @ApiProperty({
    enum: () => MailAuditAction,
    enumName: "MailAuditAction",
    enumSchema: { description: "What a proposed label change does" },
    required: true,
    description: "Whether the label is added or removed",
  })
  action: MailAuditAction;

  @ApiProperty({
    enum: () => MailAuditRule,
    enumName: "MailAuditRule",
    enumSchema: {
      description: "What proposed a change: an audit rule, or the classifier",
    },
    required: true,
    description: "The rule that proposed it",
  })
  rule: MailAuditRule;

  @ApiProperty({
    enum: () => MailDecision,
    enumName: "MailDecision",
    enumSchema: { description: "What was decided about a proposal" },
    required: false,
    description:
      "What was decided: applied by a batch, or processed without change; absent while undecided",
  })
  decision?: MailDecision;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How sure the rule is, 0 to 1",
  })
  confidence: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The sender's received messages the rule looked at (the sender rule)",
  })
  senderMessages?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "How many of them have the label (the sender rule)",
  })
  senderLabelMessages?: number;

  @ApiProperty({
    type: Boolean,
    required: false,
    description:
      "Whether it is at or above its label's threshold, so applied unless unticked (the classifier)",
  })
  ticked?: boolean;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class RunMailAuditResponse {
  @ApiProperty({
    type: () => MailAuditRun,
    isArray: true,
    required: true,
    description: "The new runs, one per account of the caller's",
  })
  runs: MailAuditRun[];
}

export class GetMailAuditResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The confidence at and above which a change counts as high confidence",
  })
  highConfidence: number;

  @ApiProperty({
    type: () => MailAuditSummary,
    required: false,
    description: "The latest audit's totals; absent before the first run",
  })
  summary?: MailAuditSummary;

  @ApiProperty({
    type: () => MailAuditLabel,
    isArray: true,
    required: true,
    description: "Every user label, by name, with the latest audit's proposals",
  })
  labels: MailAuditLabel[];

  @ApiProperty({
    type: () => MailAuditMerge,
    isArray: true,
    required: true,
    description: "Merge candidates, the closest overlap first",
  })
  merges: MailAuditMerge[];

  @ApiProperty({
    type: () => MailAuditThread,
    isArray: true,
    required: true,
    description:
      "Threads whose messages disagree, the largest first (at most 50)",
  })
  threads: MailAuditThread[];

  @ApiProperty({
    type: () => MailStarStatistics,
    required: true,
    description: "Stars over the caller's mail",
  })
  stars: MailStarStatistics;
}

export class ListMailAuditChangesResponse extends PaginatedResults {
  @ApiProperty({
    type: () => MailAuditChange,
    isArray: true,
    required: true,
    description: "A page of proposed changes",
  })
  changes: MailAuditChange[];
}
