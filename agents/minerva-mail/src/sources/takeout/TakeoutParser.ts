import type { MailSourceMessage } from "../MailSourceMessage";
import { MimeParseError } from "../MimeParseError";
import { parseRawMessage } from "../parseRawMessage";
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

    // Takeout carries the thread and the labels in headers of its own,
    // read from the parsed message below.
    let parsed: Awaited<ReturnType<typeof parseRawMessage>>;
    try {
      parsed = await parseRawMessage(entry.raw, {
        gmailId,
        threadId: "0",
        receivedAt,
        labels: [],
        flags: classifyLabels([]).flags,
        categories: [],
      });
    } catch (e) {
      throw new TakeoutParseError(
        "mime",
        entry.offset,
        e instanceof MimeParseError ? e.causeName : undefined,
      );
    }
    const { message, header } = parsed;

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
    return { ...message, threadId, labels, flags, categories };
  }
}
