import PostalMime, { type Address, type Email } from "postal-mime";
import { htmlToText, snippetOf } from "../bodyText";
import type {
  MailAddress,
  MailAttachment,
  MailSourceMessage,
} from "../MailSourceMessage";
import { decimalToGmailId } from "./gmailIds";
import type { MboxEntry } from "./MboxReader";
import { classifyLabels, parseLabelHeader } from "./takeoutLabels";
import { TakeoutParseError } from "./TakeoutParseError";

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

/** `Fri Oct 02 03:46:59 +0000 2026`, the separator's date. */
const SEPARATOR_DATE =
  /^\w{3} (\w{3}) +(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2}) (\d{4})$/;

export const parseSeparatorDate = (value: string): string | undefined => {
  const m = SEPARATOR_DATE.exec(value.trim());
  if (!m || MONTHS[m[1]] === undefined) return undefined;
  const utc = Date.UTC(
    Number(m[9]),
    MONTHS[m[1]],
    Number(m[2]),
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
  );
  const zone = (Number(m[7]) * 60 + Number(m[8])) * (m[6] === "-" ? -1 : 1);
  return new Date(utc - zone * 60_000).toISOString();
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
 * One Takeout message to the shape every source yields. Attachments are
 * decoded to be measured and then dropped; the text is kept only on the
 * returned object.
 */
export class TakeoutParser {
  async parse(entry: MboxEntry): Promise<MailSourceMessage> {
    let gmailId: string;
    try {
      gmailId = decimalToGmailId(entry.decimalId);
    } catch {
      throw new TakeoutParseError("bad-id", entry.offset);
    }
    const receivedAt = parseSeparatorDate(entry.separatorDate);
    if (!receivedAt) throw new TakeoutParseError("bad-date", entry.offset);

    let email: Email;
    try {
      email = await PostalMime.parse(entry.raw, {
        attachmentEncoding: "arraybuffer",
      });
    } catch (e) {
      throw new TakeoutParseError(
        "mime",
        entry.offset,
        e instanceof Error ? e.name : undefined,
      );
    }
    const header = (key: string) =>
      unfold(email.headers.find((h) => h.key === key)?.value);

    const thread = header("x-gm-thrid");
    if (!thread) throw new TakeoutParseError("no-thread-id", entry.offset);
    let threadId: string;
    try {
      threadId = decimalToGmailId(thread);
    } catch {
      throw new TakeoutParseError("bad-thread-id", entry.offset);
    }

    const labelHeader = header("x-gmail-labels");
    const { labels, flags, categories } = classifyLabels(
      labelHeader ? parseLabelHeader(labelHeader) : [],
    );

    const sent = email.date ? new Date(email.date) : undefined;
    const text = email.text?.trim()
      ? email.text.trim()
      : email.html
        ? htmlToText(email.html)
        : "";
    const attachments: MailAttachment[] = email.attachments.map((a) => ({
      mimeType: a.mimeType.toLowerCase(),
      ...(extensionOf(a.filename)
        ? { extension: extensionOf(a.filename) }
        : {}),
      sizeBytes: sizeOf(a.content),
      inline: a.disposition === "inline" || a.related === true,
    }));

    return {
      gmailId,
      threadId,
      receivedAt,
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
      sizeBytes: entry.raw.length,
      labels,
      flags,
      categories,
      attachments,
      text,
      snippet: snippetOf(text),
    };
  }
}
