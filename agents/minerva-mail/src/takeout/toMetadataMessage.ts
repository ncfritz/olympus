import type { MailMetadataMessage } from "@ncfritz/olympus-messages";
import type {
  MailAddress,
  MailSourceMessage,
} from "../sources/MailSourceMessage";

const address = (a: MailAddress) => ({
  address: a.address,
  name: a.name ?? null,
});

/**
 * What the agent publishes of a message: its metadata and snippet, never
 * its text (ADR 0030). The text stays on the source message, in memory.
 */
export const toMetadataMessage = (
  message: MailSourceMessage,
  accountId: string,
  source: MailMetadataMessage["source"],
  snapshotTime: Date,
): MailMetadataMessage => ({
  accountId,
  source,
  snapshotTime: snapshotTime.toISOString(),
  gmailId: message.gmailId,
  threadId: message.threadId,
  receivedAt: message.receivedAt,
  sentAt: message.sentAt ?? null,
  from: message.from ? address(message.from) : null,
  replyTo: message.replyTo.map(address),
  to: message.to.map(address),
  cc: message.cc.map(address),
  deliveredTo: message.deliveredTo ?? null,
  listId: message.listId ?? null,
  hasListUnsubscribe: message.hasListUnsubscribe,
  messageIdHeader: message.messageIdHeader ?? null,
  subject: message.subject ?? null,
  snippet: message.snippet,
  sizeBytes: message.sizeBytes,
  labels: message.labels,
  categories: message.categories,
  flags: {
    inbox: message.flags.inbox,
    unread: message.flags.unread,
    starred: message.flags.starred,
    important: message.flags.important,
    sent: message.flags.sent,
  },
  attachments: message.attachments.map((a) => ({
    mimeType: a.mimeType,
    extension: a.extension ?? null,
    sizeBytes: a.sizeBytes,
    inline: a.inline,
  })),
});
