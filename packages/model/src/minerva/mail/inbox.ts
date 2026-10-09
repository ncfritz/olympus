import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { MailChangeBatch } from "./changes";
import { MailPaymentMatch } from "./payments";
import { MailStarIcon } from "./sync";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Which of the inbox's messages to list. */
export enum MailInboxStatus {
  /** In the inbox, nothing decided yet. */
  Review = "review",
  /** In the inbox, unread. */
  Unread = "unread",
  /** Approved since `approvedSince`, wherever they are now. */
  Approved = "approved",
  /** Everything in the inbox. */
  All = "all",
}

/** How the inbox is ordered. */
export enum MailInboxSort {
  /** When it was received. */
  ReceivedTime = "receivedTime",
  /** Its most confident suggestion, then newest. */
  Confidence = "confidence",
  /** The sender's name, then address, then newest. */
  From = "from",
  /** The subject, then newest. */
  Subject = "subject",
}

/** What was decided about a message's suggestion. */
export enum MailInboxDecision {
  /** Its labels written, as suggested or amended. */
  Approved = "approved",
  /** Left for now; Gmail unchanged. */
  Skipped = "skipped",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A label suggested for a message in the inbox. */
export class MailInboxSuggestion {
  @ApiProperty({
    type: String,
    required: true,
    description: "The label's full name",
  })
  label: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The serving model's calibrated score, 0 to 1",
  })
  score: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "At or above the label's threshold: applied on approval unless unticked",
  })
  ticked: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the message has the label already",
  })
  onMessage: boolean;
}

/** A message in the inbox (or decided), with its suggestion. */
export class MailInboxMessage {
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

  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages in its thread that Minerva keeps",
  })
  threadSize: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "The sender's name, if the From header gives one",
  })
  fromName?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The sender's address",
  })
  fromAddress?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The subject",
  })
  subject?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Gmail's snippet, at most 200 characters",
  })
  snippet: string;

  @ApiTimestamp({
    required: true,
    description: "When Gmail received it",
  })
  receivedTime: Moment;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether it is in the inbox now",
  })
  inInbox: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether it is unread",
  })
  unread: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether it is starred",
  })
  starred: boolean;

  @ApiProperty({
    enum: () => MailStarIcon,
    enumName: "MailStarIcon",
    enumSchema: { description: "Gmail's star icons, by search name" },
    required: false,
    description: "A starred message's star icon",
  })
  starIcon?: MailStarIcon;

  @ApiProperty({
    type: [String],
    required: true,
    description: "Its user labels now, by full name",
  })
  labels: string[];

  @ApiProperty({
    type: () => MailInboxSuggestion,
    isArray: true,
    required: true,
    description:
      "The labels suggested for it, best first; empty if it was not scored, or nothing scored high enough",
  })
  suggestions: MailInboxSuggestion[];

  @ApiTimestamp({
    required: false,
    description: "When it was scored; absent if it has not been",
  })
  scoredTime?: Moment;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "Its best ticked suggestion it does not have yet; absent when there is nothing to add",
  })
  topScore?: number;

  @ApiProperty({
    enum: () => MailInboxDecision,
    enumName: "MailInboxDecision",
    enumSchema: {
      description: "What was decided about a message's suggestion",
    },
    required: false,
    description: "What was decided; absent while it is to review",
  })
  decision?: MailInboxDecision;

  @ApiTimestamp({
    required: false,
    description: "When it was decided",
  })
  decidedTime?: Moment;

  @ApiProperty({
    type: Boolean,
    required: false,
    description:
      "For an approval, whether the labels were other than the ticked suggestion's",
  })
  amended?: boolean;

  @ApiProperty({
    type: () => MailPaymentMatch,
    required: false,
    description:
      "When it reads as a payment of an open bill: the bill, and the state it moves to",
  })
  payment?: MailPaymentMatch;
}

/** The inbox's statistics strip. */
export class MailInboxSummary {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages in the inbox",
  })
  inInbox: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "In the inbox with nothing decided",
  })
  toReview: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "To review with a ticked suggestion of 90% or more that the message does not have",
  })
  highConfidence: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "To review with no ticked suggestion to add",
  })
  noSuggestion: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "In the inbox and unread",
  })
  unread: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Approved since `approvedSince`",
  })
  approved: number;
}

/** One message's approval: its labels as the picker left them. */
export class MailInboxApproval {
  @ApiProperty({
    type: String,
    required: true,
    description: "The message's Gmail ID",
  })
  gmailId: string;

  @ApiProperty({
    type: [String],
    required: true,
    description: "User labels to add, by full name",
  })
  add: string[];

  @ApiProperty({
    type: [String],
    required: true,
    description: "User labels to remove, by full name",
  })
  remove: string[];
}

/** A sender or recipient, as a message's headers name them. */
export class MailMessageAddress {
  @ApiProperty({ type: String, required: true, description: "The address" })
  address: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The display name, if given",
  })
  name?: string;
}

/** What is attached to a message; its content is not sent. */
export class MailMessageAttachmentInfo {
  @ApiProperty({
    type: String,
    required: false,
    description: "Its file name, if it has one",
  })
  filename?: string;

  @ApiProperty({ type: String, required: true, description: "Its MIME type" })
  mimeType: string;

  @ApiProperty({ type: Number, required: true, description: "Its size" })
  sizeBytes: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Shown in the body (an inline image) rather than attached",
  })
  inline: boolean;
}

/**
 * A message read live from Gmail to be shown once: never stored, logged
 * or cached.
 */
export class MailMessageContent {
  @ApiProperty({
    type: String,
    required: true,
    description: "The message's Gmail ID",
  })
  gmailId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its thread's Gmail ID",
  })
  threadId: string;

  @ApiProperty({ type: String, required: false, description: "The subject" })
  subject?: string;

  @ApiProperty({
    type: () => MailMessageAddress,
    required: false,
    description: "The sender",
  })
  from?: MailMessageAddress;

  @ApiProperty({
    type: () => MailMessageAddress,
    isArray: true,
    required: true,
    description: "Reply-To",
  })
  replyTo: MailMessageAddress[];

  @ApiProperty({
    type: () => MailMessageAddress,
    isArray: true,
    required: true,
    description: "To",
  })
  to: MailMessageAddress[];

  @ApiProperty({
    type: () => MailMessageAddress,
    isArray: true,
    required: true,
    description: "Cc",
  })
  cc: MailMessageAddress[];

  @ApiTimestamp({
    required: false,
    description: "When it was sent, by its Date header",
  })
  sentTime?: Moment;

  @ApiTimestamp({
    required: true,
    description: "When Gmail received it",
  })
  receivedTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The plain text body, or the HTML's text when it has none; at most 1,000,000 characters",
  })
  text: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The HTML body as sent, not sanitized: show it only in a sandboxed frame with remote content blocked; at most 1,000,000 characters. Its own images (cid:) are put in as data: URLs, and its remote images point at ProxyMailImage when imageProxy is given",
  })
  html?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "Where the HTML's remote images were pointed (ProxyMailImage's address, ending in /): the one remote source the frame should allow images from. Absent when the API has no public address, and the images were left as sent",
  })
  imageProxy?: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether a body was cut at the limit",
  })
  truncated: boolean;

  @ApiProperty({
    type: () => MailMessageAttachmentInfo,
    isArray: true,
    required: true,
    description: "What is attached, without its content",
  })
  attachments: MailMessageAttachmentInfo[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ApproveMailMessagesRequest {
  @ApiProperty({
    type: () => MailInboxApproval,
    isArray: true,
    required: true,
    description: "Up to 500 messages, each with its labels to add and remove",
  })
  messages: MailInboxApproval[];

  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Archive them too (take them out of the inbox)",
  })
  archive?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Mark them read too",
  })
  markRead?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    description:
      "Apply the same to every message in their threads, as Gmail labels a conversation",
  })
  wholeThread?: boolean;

  @ApiProperty({
    type: [String],
    required: false,
    description: "Labels to create in Gmail first (made in the picker)",
  })
  newLabels?: string[];
}

export class SkipMailMessagesRequest {
  @ApiProperty({
    type: [String],
    required: true,
    description: "Up to 500 messages by Gmail ID",
  })
  gmailIds: string[];
}

export class UpdateMailMessageFlagsRequest {
  @ApiProperty({
    type: [String],
    required: true,
    description: "Up to 500 messages by Gmail ID",
  })
  gmailIds: string[];

  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Archive them (take them out of the inbox)",
  })
  archive?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Mark them read",
  })
  markRead?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    description: "The same for every message in their threads",
  })
  wholeThread?: boolean;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListMailInboxResponse extends PaginatedResults {
  @ApiProperty({
    type: () => MailInboxMessage,
    isArray: true,
    required: true,
    description: "A page of messages",
  })
  messages: MailInboxMessage[];

  @ApiProperty({
    type: () => MailInboxSummary,
    required: true,
    description: "The counts for the statistics strip",
  })
  summary: MailInboxSummary;
}

export class ApproveMailMessagesResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages in the inbox recorded as approved",
  })
  approved: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages whose labels or flags are written to Gmail",
  })
  changed: number;

  @ApiProperty({
    type: () => MailChangeBatch,
    required: false,
    description:
      "The batch writing them, followed in the change log; absent when Gmail needed no change",
  })
  batch?: MailChangeBatch;
}

export class SkipMailMessagesResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages recorded as skipped",
  })
  skipped: number;
}

export class UpdateMailMessageFlagsResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages whose flags are written to Gmail",
  })
  changed: number;

  @ApiProperty({
    type: () => MailChangeBatch,
    required: false,
    description:
      "The batch writing them; absent when they were so already in Minerva",
  })
  batch?: MailChangeBatch;
}

export class GetMailMessageContentResponse {
  @ApiProperty({
    type: () => MailMessageContent,
    required: true,
    description: "The message as Gmail has it now",
  })
  content: MailMessageContent;
}
