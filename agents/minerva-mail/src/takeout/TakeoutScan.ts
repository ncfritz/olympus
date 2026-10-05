import { MboxReader } from "../sources/takeout/MboxReader";
import { TakeoutParseError } from "../sources/takeout/TakeoutParseError";
import { TakeoutParser } from "../sources/takeout/TakeoutParser";

export type TakeoutScanOptions = {
  /** The byte offset of a separator line to start from. */
  offset?: number;
  /** Stop after this many messages. */
  limit?: number;
  /** Stop after the message that crosses this much time. */
  maxSeconds?: number;
  /** Called every `progressEvery` messages. */
  onProgress?: (messages: number, bytes: number, seconds: number) => void;
  progressEvery?: number;
};

/**
 * What a scan found: counts only, never content. `nextOffset` is where to
 * resume, or null at the end of the archive.
 */
export type TakeoutScanReport = {
  startOffset: number;
  nextOffset: number | null;
  seconds: number;
  messages: number;
  parsed: number;
  failed: Record<string, number>;
  /** The first few failures' byte offsets, to look at with care. */
  failedOffsets: number[];
  skipped: { chat: number; trash: number; spam: number; draft: number };
  flags: Record<string, number>;
  categories: Record<string, number>;
  distinctLabels: number;
  messagesWithoutLabels: number;
  withText: number;
  withoutText: number;
  withAttachments: number;
  attachments: number;
  withFrom: number;
  withListId: number;
  withListUnsubscribe: number;
  duplicateIds: number;
  slowestParseMs: number;
  largestMessageBytes: number;
};

const bump = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

/**
 * Reads and parses an archive the way the import will, and reports how it
 * went. Writes nothing and publishes nothing.
 */
export class TakeoutScan {
  constructor(
    private readonly reader = new MboxReader(),
    private readonly parser = new TakeoutParser(),
  ) {}

  async run(
    path: string,
    options: TakeoutScanOptions = {},
  ): Promise<TakeoutScanReport> {
    const startOffset = options.offset ?? 0;
    const started = Date.now();
    const labels = new Set<string>();
    const ids = new Set<string>();
    const report: TakeoutScanReport = {
      startOffset,
      nextOffset: null,
      seconds: 0,
      messages: 0,
      parsed: 0,
      failed: {},
      failedOffsets: [],
      skipped: { chat: 0, trash: 0, spam: 0, draft: 0 },
      flags: {},
      categories: {},
      distinctLabels: 0,
      messagesWithoutLabels: 0,
      withText: 0,
      withoutText: 0,
      withAttachments: 0,
      attachments: 0,
      withFrom: 0,
      withListId: 0,
      withListUnsubscribe: 0,
      duplicateIds: 0,
      slowestParseMs: 0,
      largestMessageBytes: 0,
    };
    let bytes = 0;

    for await (const entry of this.reader.read(path, startOffset)) {
      const stop =
        (options.limit !== undefined && report.messages >= options.limit) ||
        (options.maxSeconds !== undefined &&
          (Date.now() - started) / 1000 >= options.maxSeconds);
      if (stop) {
        report.nextOffset = entry.offset;
        break;
      }
      report.messages++;
      bytes += entry.raw.length;
      report.largestMessageBytes = Math.max(
        report.largestMessageBytes,
        entry.raw.length,
      );
      const t = Date.now();
      try {
        const message = await this.parser.parse(entry);
        report.slowestParseMs = Math.max(report.slowestParseMs, Date.now() - t);
        report.parsed++;
        if (ids.has(message.gmailId)) report.duplicateIds++;
        ids.add(message.gmailId);
        const { flags } = message;
        if (flags.chat) report.skipped.chat++;
        else if (flags.trash) report.skipped.trash++;
        else if (flags.spam) report.skipped.spam++;
        else if (flags.draft) report.skipped.draft++;
        for (const [flag, on] of Object.entries(flags)) {
          if (on) bump(report.flags, flag);
        }
        for (const category of message.categories) {
          bump(report.categories, category);
        }
        message.labels.forEach((l) => labels.add(l));
        if (!message.labels.length) report.messagesWithoutLabels++;
        if (message.text) report.withText++;
        else report.withoutText++;
        if (message.attachments.length) report.withAttachments++;
        report.attachments += message.attachments.length;
        if (message.from) report.withFrom++;
        if (message.listId) report.withListId++;
        if (message.hasListUnsubscribe) report.withListUnsubscribe++;
      } catch (e) {
        const reason = e instanceof TakeoutParseError ? e.reason : "other";
        bump(report.failed, reason);
        if (report.failedOffsets.length < 10) {
          report.failedOffsets.push(entry.offset);
        }
      }
      if (
        options.onProgress &&
        report.messages % (options.progressEvery ?? 10_000) === 0
      ) {
        options.onProgress(
          report.messages,
          bytes,
          (Date.now() - started) / 1000,
        );
      }
    }
    report.distinctLabels = labels.size;
    report.seconds = Math.round((Date.now() - started) / 1000);
    return report;
  }
}
