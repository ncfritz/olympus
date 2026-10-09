import { MailApi } from "@ncfritz/olympus-client";
import { Injectable, Logger } from "@nestjs/common";
import {
  ClassifierClient,
  type ClassifierMessage,
} from "../classifier/ClassifierClient";
import { parseRawMessage } from "../sources/parseRawMessage";
import { noFlags } from "../sources/takeout/takeoutLabels";
import {
  FEATURIZE_BATCH,
  toClassifierMessage,
} from "../takeout/TakeoutFeaturize";
import { GmailClient, gmailStatusOf, type GmailMailbox } from "./GmailClient";

/** Messages read again a mailbox a run, newest first, by default. */
export const EMBED_MISSING_LIMIT = 1000;

/** What embedding a mailbox's missed mail did: counts only, never content. */
export type GmailEmbedMissingReport = {
  accountId: string;
  email: string;
  /** The classifier's embedding version; null when it has no model. */
  version: string | null;
  /** Messages without a vector when the run began. */
  missing: number;
  /** Read again this run: the newest, at most the limit. */
  read: number;
  embedded: number;
  /** Gone from Gmail: deleted since they were featurized. */
  gone: number;
  failed: number;
  requests: number;
  seconds: number;
};

const describe = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * The nightly backstop for embeddings (docs/plans/email-management, phase
 * 6): new mail is embedded as it is featurized, unless the embedding model
 * was down then. The classifier lists what it featurized without a vector;
 * each message is read again from Gmail and its text sent to be embedded,
 * held only until its batch is sent; nothing is published or stored here.
 */
@Injectable()
export class GmailEmbedMissing {
  private readonly logger = new Logger(GmailEmbedMissing.name);

  constructor(
    private readonly mail: MailApi,
    private readonly gmail: GmailClient,
    private readonly classifier: ClassifierClient,
  ) {}

  /** Every linked mailbox, or the one named. */
  async run(
    email?: string,
    options: {
      limit?: number;
      open?: (email: string) => GmailMailbox;
    } = {},
  ): Promise<GmailEmbedMissingReport[]> {
    if (!this.classifier.configured) {
      throw new Error(
        "Embedding needs the classifier: set MAIL_ML_URL and the agent's certificate",
      );
    }
    const accounts = await this.mail.listMailSyncAccounts();
    const address = email?.trim().toLowerCase();
    const chosen = address
      ? accounts.filter((a) => a.email === address)
      : accounts;
    if (address && chosen.length === 0) {
      throw new Error(`No mail account ${address} linked to Gmail in Minerva`);
    }
    const reports: GmailEmbedMissingReport[] = [];
    for (const account of chosen) {
      reports.push(await this.embedAccount(account, options));
    }
    return reports;
  }

  private async embedAccount(
    account: { id: string; email: string },
    options: { limit?: number; open?: (email: string) => GmailMailbox },
  ): Promise<GmailEmbedMissingReport> {
    const started = Date.now();
    const report: GmailEmbedMissingReport = {
      accountId: account.id,
      email: account.email,
      version: null,
      missing: 0,
      read: 0,
      embedded: 0,
      gone: 0,
      failed: 0,
      requests: 0,
      seconds: 0,
    };
    const listed = await this.classifier.listMissingEmbeddings(
      account.id,
      options.limit ?? EMBED_MISSING_LIMIT,
    );
    if (!listed) {
      this.logger.warn(
        "The classifier has no embedding model (OLLAMA_URL): nothing to embed",
      );
      return report;
    }
    report.version = listed.version;
    report.missing = listed.missing;
    if (listed.gmailIds.length === 0) return report;

    const mailbox = (options.open ?? ((e) => this.gmail.mailbox(e)))(
      account.email,
    );
    let pending: ClassifierMessage[] = [];
    // A model that fails a batch will fail the next: stop the account.
    let down = false;
    const flush = async () => {
      if (pending.length === 0 || down) return;
      const sent = pending;
      pending = [];
      try {
        report.embedded += (
          await this.classifier.putEmbeddings(account.id, sent)
        ).stored;
      } catch (error) {
        report.failed += sent.length;
        down = true;
        this.logger.warn(
          `Could not embed ${sent.length} messages of ${account.email}: ${describe(error)}`,
        );
      }
    };

    for (const id of listed.gmailIds) {
      if (down) break;
      try {
        const raw = await mailbox.raw(id);
        report.read++;
        const { message } = await parseRawMessage(
          Buffer.from(raw.raw, "base64url"),
          {
            gmailId: raw.id,
            threadId: raw.threadId,
            receivedAt: new Date(Number(raw.internalDate)).toISOString(),
            labels: [],
            flags: noFlags(),
            categories: [],
          },
        );
        pending.push(toClassifierMessage(message));
        if (pending.length >= FEATURIZE_BATCH) await flush();
      } catch (error) {
        if (gmailStatusOf(error) === 404) {
          report.gone++;
        } else {
          report.failed++;
          this.logger.warn(`Could not read message ${id}: ${describe(error)}`);
        }
      }
    }
    await flush();
    report.requests = mailbox.requests;
    report.seconds = Math.round((Date.now() - started) / 1000);
    return report;
  }
}
