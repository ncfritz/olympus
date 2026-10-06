import PostalMime, { type Address, type Email } from "postal-mime";
import { htmlToText, snippetOf } from "./bodyText";
import { MimeParseError } from "./MimeParseError";
import type {
  MailAddress,
  MailAttachment,
  MailFlags,
  MailSourceMessage,
} from "./MailSourceMessage";

/** What the source knows of a message besides its RFC 822 text. */
export type RawMessageEnvelope = {
  gmailId: string;
  threadId: string;
  receivedAt: string;
  labels: string[];
  flags: MailFlags;
  categories: string[];
};

const mailboxes = (addresses: Address[] | Address | undefined): MailAddress[] =>
  (Array.isArray(addresses) ? addresses : addresses ? [addresses] : [])
    .flatMap((a) => (a.group ? a.group : [a]))
    .filter((m) => m.address)
    .map((m) => ({
      address: (m.address ?? "").trim().toLowerCase(),
      ...(m.name ? { name: m.name.trim() } : {}),
    }));

const listIdOf = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const inside = /<([^>]+)>/.exec(value);
  return (inside ? inside[1] : value).trim().toLowerCase() || undefined;
};

const extensionOf = (filename: string | null): string | undefined => {
  const m = filename ? /\.([A-Za-z0-9]{1,10})$/.exec(filename.trim()) : null;
  return m ? m[1].toLowerCase() : undefined;
};

const sizeOf = (content: ArrayBuffer | Uint8Array | string): number =>
  typeof content === "string" ? Buffer.byteLength(content) : content.byteLength;

/** Folded header values arrive with their line breaks. */
const unfold = (value: string | undefined): string | undefined =>
  value?.replace(/\r?\n[ \t]*/g, " ").trim();

/**
 * A message's RFC 822 text to the shape every source yields, the same for a
 * Takeout archive and Gmail's raw format. Attachments are decoded to be
 * measured and then dropped; the text is kept only on the returned object.
 *
 * @throws MimeParseError when the text is not MIME
 */
export const parseRawMessage = async (
  raw: string | Uint8Array,
  envelope: RawMessageEnvelope,
): Promise<{
  message: MailSourceMessage;
  header: (key: string) => string | undefined;
}> => {
  let email: Email;
  try {
    email = await PostalMime.parse(raw, { attachmentEncoding: "arraybuffer" });
  } catch (e) {
    throw new MimeParseError(e instanceof Error ? e.name : undefined);
  }
  const header = (key: string) =>
    unfold(email.headers.find((h) => h.key === key)?.value);

  const sent = email.date ? new Date(email.date) : undefined;
  const text = email.text?.trim()
    ? email.text.trim()
    : email.html
      ? htmlToText(email.html)
      : "";
  const attachments: MailAttachment[] = email.attachments.map((a) => ({
    mimeType: a.mimeType.toLowerCase(),
    ...(extensionOf(a.filename) ? { extension: extensionOf(a.filename) } : {}),
    sizeBytes: sizeOf(a.content),
    inline: a.disposition === "inline" || a.related === true,
  }));

  const message: MailSourceMessage = {
    gmailId: envelope.gmailId,
    threadId: envelope.threadId,
    receivedAt: envelope.receivedAt,
    ...(sent && !Number.isNaN(sent.getTime())
      ? { sentAt: sent.toISOString() }
      : {}),
    from: mailboxes(email.from)[0],
    replyTo: mailboxes(email.replyTo),
    to: mailboxes(email.to),
    cc: mailboxes(email.cc),
    ...(email.deliveredTo
      ? { deliveredTo: email.deliveredTo.trim().toLowerCase() }
      : {}),
    ...(listIdOf(header("list-id"))
      ? { listId: listIdOf(header("list-id")) }
      : {}),
    hasListUnsubscribe: header("list-unsubscribe") !== undefined,
    ...(email.messageId ? { messageIdHeader: email.messageId.trim() } : {}),
    ...(email.subject !== undefined ? { subject: email.subject.trim() } : {}),
    sizeBytes: typeof raw === "string" ? Buffer.byteLength(raw) : raw.length,
    labels: envelope.labels,
    flags: envelope.flags,
    categories: envelope.categories,
    attachments,
    text,
    snippet: snippetOf(text),
  };
  return { message, header };
};
