/**
 * Mail (ADR 0030): the Minerva mail agent publishes each message's
 * metadata to MAIL_MESSAGES_EXCHANGE as it reads it, from a Takeout
 * archive or (from phase 1b) the Gmail API; the API writes it into
 * Minerva by the message's Gmail ID. Delivery is at least once, and
 * `snapshotTime` orders two writes of the same message.
 *
 * Metadata only: a message's body never travels on a queue. The snippet
 * (at most 200 characters) is the one piece of it that does.
 */

import { exchange, route } from "./routing";

export const MAIL_MESSAGES_EXCHANGE = exchange("mail.messages", "topic");

/**
 * Why the message was published: a message's whole metadata (`upsert`);
 * from phase 1b, a message's labels and flags only, when Gmail's changed
 * and nothing else did (`labels`); and a message gone from Gmail
 * (`delete`).
 */
export const MAIL_MESSAGE_ACTIONS = ["upsert", "labels", "delete"] as const;
export type MailMessageAction = (typeof MAIL_MESSAGE_ACTIONS)[number];

/** Where the agent read the message. */
export type MailMessageSource = "takeout" | "gmail";

export interface MailMessageAddress {
  /** Lower case. */
  address: string;
  name: string | null;
}

export interface MailMessageAttachment {
  mimeType: string;
  /** Lower case, without the dot. */
  extension: string | null;
  sizeBytes: number;
  /** Embedded (an inline image) rather than attached. */
  inline: boolean;
}

/** Gmail's system labels that are flags on the message. */
export interface MailMessageFlags {
  inbox: boolean;
  unread: boolean;
  starred: boolean;
  important: boolean;
  sent: boolean;
}

/** One message's metadata. */
export interface MailMetadataMessage {
  /** The Olympus mail account (ImportMailAccount, or linking in 1b). */
  accountId: string;
  source: MailMessageSource;
  /** When the agent read the message, ISO-8601. */
  snapshotTime: string;
  /** Gmail's message ID, hexadecimal. */
  gmailId: string;
  /** Gmail's thread ID, hexadecimal. */
  threadId: string;
  /** When Gmail received it, ISO-8601. */
  receivedAt: string;
  /** The Date header, ISO-8601, when it parsed. */
  sentAt: string | null;
  from: MailMessageAddress | null;
  replyTo: MailMessageAddress[];
  to: MailMessageAddress[];
  cc: MailMessageAddress[];
  deliveredTo: string | null;
  listId: string | null;
  hasListUnsubscribe: boolean;
  messageIdHeader: string | null;
  subject: string | null;
  /** At most 200 characters of the body, whitespace collapsed. */
  snippet: string;
  sizeBytes: number;
  /** User labels by full name (`Accounts/Utilities`). */
  labels: string[];
  /** Gmail's categories, lower case (`updates`, `promotions`). */
  categories: string[];
  flags: MailMessageFlags;
  attachments: MailMessageAttachment[];
}

/**
 * A message's labels and flags as Gmail has them now (`message.labels`),
 * replacing Minerva's. Written only over an older snapshot, as an upsert is.
 */
export interface MailLabelsMessage {
  accountId: string;
  source: MailMessageSource;
  snapshotTime: string;
  gmailId: string;
  /** User labels by full name. */
  labels: string[];
  /** Gmail's categories, lower case. */
  categories: string[];
  flags: MailMessageFlags;
}

/**
 * A message no longer in Gmail (`message.delete`): deleted, or in Trash or
 * Spam. Minerva forgets it, unless it holds a newer snapshot.
 */
export interface MailDeleteMessage {
  accountId: string;
  source: MailMessageSource;
  snapshotTime: string;
  gmailId: string;
}

/** What each action carries. */
export interface MailMessageBodies {
  upsert: MailMetadataMessage;
  labels: MailLabelsMessage;
  delete: MailDeleteMessage;
}

/** `message.<action>` on MAIL_MESSAGES_EXCHANGE. */
export const mailMessageRoute = <A extends MailMessageAction>(action: A) =>
  route<MailMessageBodies[A]>(MAIL_MESSAGES_EXCHANGE, `message.${action}`);
