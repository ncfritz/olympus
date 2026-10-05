/**
 * One message as a source (a Takeout archive, or the Gmail API from phase
 * 1b) yields it, normalized so everything after the source is the same
 * (docs/plans/email-management/README.md, phase 1a).
 *
 * `text` is the body as plain text, for the classifier, in memory only: it
 * is never published, stored or logged (ADR 0030). `snippet` is the one
 * piece of the body that is kept.
 */
export type MailAddress = {
  /** Lower case. */
  address: string;
  name?: string;
};

export type MailAttachment = {
  mimeType: string;
  /** Lower case, without the dot, when the part has a file name. */
  extension?: string;
  sizeBytes: number;
  /** Inline (an embedded image) rather than attached. */
  inline: boolean;
};

/** Gmail's system labels, as flags. */
export type MailFlags = {
  inbox: boolean;
  unread: boolean;
  starred: boolean;
  important: boolean;
  sent: boolean;
  draft: boolean;
  trash: boolean;
  spam: boolean;
  /** An old Hangouts chat, not mail. */
  chat: boolean;
};

export type MailSourceMessage = {
  /** Gmail's message ID, hexadecimal, as the API writes it. */
  gmailId: string;
  /** Gmail's thread ID, hexadecimal. */
  threadId: string;
  /** When Gmail received it (ISO 8601). */
  receivedAt: string;
  /** The Date header, when it parses (ISO 8601). */
  sentAt?: string;
  from?: MailAddress;
  replyTo: MailAddress[];
  to: MailAddress[];
  cc: MailAddress[];
  /** The address the message was delivered to: which of the owner's. */
  deliveredTo?: string;
  /** The List-Id header's identifier. */
  listId?: string;
  hasListUnsubscribe: boolean;
  messageIdHeader?: string;
  subject?: string;
  sizeBytes: number;
  /** User labels by name, nested by `/`, as Gmail shows them. */
  labels: string[];
  flags: MailFlags;
  /** Gmail's categories, lower case: `updates`, `promotions`, ... */
  categories: string[];
  attachments: MailAttachment[];
  /** The body as plain text. In memory only; never published or stored. */
  text: string;
  /** The first 200 characters of `text`, whitespace collapsed. */
  snippet: string;
};
