import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { MailApi } from "@ncfritz/olympus-client";
import { publishMessage } from "@ncfritz/olympus-messages";
import { Injectable, Logger } from "@nestjs/common";
import { mailMessageRoute } from "../messaging";
import type { MailSourceMessage } from "../sources/MailSourceMessage";
import { MboxReader } from "../sources/takeout/MboxReader";
import { TakeoutParseError } from "../sources/takeout/TakeoutParseError";
import { TakeoutParser } from "../sources/takeout/TakeoutParser";
import { toMetadataMessage } from "./toMetadataMessage";

export type TakeoutImportOptions = {
  /** The mailbox's address. */
  account: string;
  /** The Olympus user it belongs to. */
  owner: string;
  /** The byte offset of a separator line to start from. */
  offset?: number;
  /** Stop after this many messages. */
  limit?: number;
  /** Stop after the message that crosses this much time. */
  maxSeconds?: number;
  onProgress?: (messages: number, published: number, seconds: number) => void;
  progressEvery?: number;
};

/** What an import did: counts only, never content. */
export type TakeoutImportReport = {
  accountId: string;
  startOffset: number;
  /** Where to resume, or null at the end of the archive. */
  nextOffset: number | null;
  seconds: number;
  messages: number;
  published: number;
  skipped: { chat: number; trash: number; spam: number; draft: number };
  failed: Record<string, number>;
  failedOffsets: number[];
};

/** Why a message is not imported: not mail, or not kept. */
const skipReason = (
  message: MailSourceMessage,
): keyof TakeoutImportReport["skipped"] | undefined =>
  message.flags.chat
    ? "chat"
    : message.flags.trash
      ? "trash"
      : message.flags.spam
        ? "spam"
        : message.flags.draft
          ? "draft"
          : undefined;

/**
 * Imports a Takeout archive (docs/plans/email-management, phase 1a): the
 * account made the owner's through the API, then every message's metadata
 * published to mail.messages for the API to store. Reads the archive in
 * place and makes no Gmail API calls. Publishing the same message again
 * rewrites the same row, so a run can resume from an earlier offset.
 */
@Injectable()
export class TakeoutImport {
  private readonly logger = new Logger(TakeoutImport.name);

  constructor(
    private readonly amqp: AmqpConnection,
    private readonly mail: MailApi,
    private readonly reader: MboxReader,
    private readonly parser: TakeoutParser,
  ) {}

  async run(
    path: string,
    options: TakeoutImportOptions,
  ): Promise<TakeoutImportReport> {
    const account = await this.mail.importMailAccount(
      options.account,
      options.owner,
    );
    this.logger.log(`Importing into mail account ${account.id}`);
    const startOffset = options.offset ?? 0;
    const started = Date.now();
    const report: TakeoutImportReport = {
      accountId: account.id,
      startOffset,
      nextOffset: null,
      seconds: 0,
      messages: 0,
      published: 0,
      skipped: { chat: 0, trash: 0, spam: 0, draft: 0 },
      failed: {},
      failedOffsets: [],
    };

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
      let message: MailSourceMessage;
      try {
        message = await this.parser.parse(entry);
      } catch (e) {
        const reason = e instanceof TakeoutParseError ? e.reason : "other";
        report.failed[reason] = (report.failed[reason] ?? 0) + 1;
        if (report.failedOffsets.length < 10) {
          report.failedOffsets.push(entry.offset);
        }
        continue;
      }
      const skip = skipReason(message);
      if (skip) {
        report.skipped[skip]++;
      } else {
        await publishMessage(
          this.amqp,
          mailMessageRoute("upsert"),
          toMetadataMessage(message, account.id, "takeout", new Date()),
          { persistent: true, contentType: "application/json" },
        );
        report.published++;
      }
      if (
        options.onProgress &&
        report.messages % (options.progressEvery ?? 10_000) === 0
      ) {
        options.onProgress(
          report.messages,
          report.published,
          (Date.now() - started) / 1000,
        );
      }
    }
    report.seconds = Math.round((Date.now() - started) / 1000);
    return report;
  }
}
