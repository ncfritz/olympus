import { MailApi } from "@ncfritz/olympus-client";
import { Injectable, Logger } from "@nestjs/common";
import {
  ClassifierClient,
  type ClassifierMessage,
} from "../classifier/ClassifierClient";
import type { MailSourceMessage } from "../sources/MailSourceMessage";
import { MboxReader } from "../sources/takeout/MboxReader";
import { TakeoutParseError } from "../sources/takeout/TakeoutParseError";
import { TakeoutParser } from "../sources/takeout/TakeoutParser";

/** Messages per request to the classifier. */
export const FEATURIZE_BATCH = 200;

export type TakeoutFeaturizeOptions = {
  account: string;
  owner: string;
  offset?: number;
  limit?: number;
  maxSeconds?: number;
  /** Whether reaching the archive's end marks the version complete. */
  complete?: boolean;
  /**
   * Embeddings instead of features (phase 6): the text goes to the
   * classifier's embedding model, and the end completes the embedding
   * version rather than the feature version.
   */
  embed?: boolean;
  onProgress?: (messages: number, featurized: number, seconds: number) => void;
  progressEvery?: number;
};

/** What a featurize run did: counts only, never content. */
export type TakeoutFeaturizeReport = {
  accountId: string;
  version: string | null;
  startOffset: number;
  nextOffset: number | null;
  seconds: number;
  messages: number;
  featurized: number;
  batches: number;
  skipped: { chat: number; trash: number; spam: number; draft: number };
  failed: Record<string, number>;
  failedOffsets: number[];
  /** Whether this run marked the version complete. */
  completed: boolean;
};

const skipReason = (
  m: MailSourceMessage,
): keyof TakeoutFeaturizeReport["skipped"] | undefined =>
  m.flags.chat
    ? "chat"
    : m.flags.trash
      ? "trash"
      : m.flags.spam
        ? "spam"
        : m.flags.draft
          ? "draft"
          : undefined;

/** What the classifier reads of a message: its text, and a few headers. */
export const toClassifierMessage = (
  m: MailSourceMessage,
): ClassifierMessage => ({
  gmailId: m.gmailId,
  receivedAt: m.receivedAt,
  subject: m.subject ?? null,
  text: m.text || null,
  fromAddress: m.from?.address ?? null,
  listId: m.listId ?? null,
  hasListUnsubscribe: m.hasListUnsubscribe,
  attachmentExtensions: m.attachments
    .map((a) => a.extension)
    .filter((e): e is string => Boolean(e)),
});

/**
 * Featurizes a Takeout archive (docs/plans/email-management phase 3), or
 * embeds it (phase 6, `embed`): each
 * kept message's text, read in memory, is sent in batches to the
 * classifier, which keeps hashed counts and drops the text. The archive is
 * read in place; nothing else sees the text. Resumable from an offset; a
 * message featurized again replaces its row. Reaching the archive's end
 * marks the classifier's feature version complete, so it serves.
 */
@Injectable()
export class TakeoutFeaturize {
  private readonly logger = new Logger(TakeoutFeaturize.name);

  constructor(
    private readonly classifier: ClassifierClient,
    private readonly mail: MailApi,
    private readonly reader: MboxReader,
    private readonly parser: TakeoutParser,
  ) {}

  async run(
    path: string,
    options: TakeoutFeaturizeOptions,
  ): Promise<TakeoutFeaturizeReport> {
    const account = await this.mail.importMailAccount(
      options.account,
      options.owner,
    );
    this.logger.log(`Featurizing mail account ${account.id}`);
    const startOffset = options.offset ?? 0;
    const started = Date.now();
    const report: TakeoutFeaturizeReport = {
      accountId: account.id,
      version: null,
      startOffset,
      nextOffset: null,
      seconds: 0,
      messages: 0,
      featurized: 0,
      batches: 0,
      skipped: { chat: 0, trash: 0, spam: 0, draft: 0 },
      failed: {},
      failedOffsets: [],
      completed: false,
    };
    let batch: ClassifierMessage[] = [];
    const flush = async () => {
      if (batch.length === 0) return;
      const sent = batch;
      batch = [];
      const answer = options.embed
        ? await this.classifier.putEmbeddings(account.id, sent)
        : await this.classifier.putFeatures(account.id, sent);
      report.version = answer.version;
      report.featurized += answer.stored;
      report.batches++;
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
        batch.push(toClassifierMessage(message));
        if (batch.length >= FEATURIZE_BATCH) await flush();
      }
      if (
        options.onProgress &&
        report.messages % (options.progressEvery ?? 10_000) === 0
      ) {
        options.onProgress(
          report.messages,
          report.featurized,
          (Date.now() - started) / 1000,
        );
      }
    }
    await flush();

    if (report.nextOffset === null && options.complete !== false) {
      // A last slice may send nothing (only chats left, say), and so not
      // learn the version: the one still building is the one to complete.
      const building = options.embed
        ? await this.classifier.listEmbeddingVersions()
        : await this.classifier.listFeatureVersions();
      const version =
        report.version ??
        building.find((v) => v.status === "building")?.version;
      if (version) {
        report.version = version;
        if (options.embed) {
          await this.classifier.completeEmbeddings(version);
        } else {
          await this.classifier.completeFeatures(version);
        }
        report.completed = true;
      }
    }
    report.seconds = Math.round((Date.now() - started) / 1000);
    return report;
  }
}
