import { MailApi } from "@ncfritz/olympus-client";
import { Injectable, Logger } from "@nestjs/common";
import type { ClassifierMessage } from "../classifier/ClassifierClient";
import { parseRawMessage } from "../sources/parseRawMessage";
import { noFlags } from "../sources/takeout/takeoutLabels";
import {
  FEATURIZE_BATCH,
  toClassifierMessage,
} from "../takeout/TakeoutFeaturize";
import { GmailClient, gmailStatusOf, type GmailMailbox } from "./GmailClient";
import { GmailMessages } from "./GmailMessages";

/** What scoring a mailbox's inbox did: counts only, never content. */
export type GmailSuggestInboxReport = {
  accountId: string;
  /** Messages in the inbox when it was listed. */
  inbox: number;
  /** Messages whose suggestions were recorded. */
  suggested: number;
  /** Gone from Gmail before they were read. */
  gone: number;
  failed: number;
  /** No model serves the account yet: nothing was scored. */
  noModel: boolean;
  requests: number;
  seconds: number;
};

/**
 * Scores what is in a linked mailbox's inbox now (docs/plans/
 * email-management phase 5), for mail that arrived before new mail was
 * scored as it came: each message read whole from Gmail, scored by the
 * classifier's serving model and its suggestions recorded. The text is
 * held only until its batch is scored; nothing is published or stored.
 */
@Injectable()
export class GmailSuggestInbox {
  private readonly logger = new Logger(GmailSuggestInbox.name);

  constructor(
    private readonly mail: MailApi,
    private readonly gmail: GmailClient,
    private readonly messages: GmailMessages,
  ) {}

  async run(
    email: string,
    options: {
      onProgress?: (done: number, of: number) => void;
      open?: (email: string) => GmailMailbox;
    } = {},
  ): Promise<GmailSuggestInboxReport> {
    if (!this.messages.featurizing) {
      throw new Error(
        "Scoring needs the classifier: set MAIL_ML_URL and the agent's certificate",
      );
    }
    const address = email.trim().toLowerCase();
    const account = (await this.mail.listMailSyncAccounts()).find(
      (a) => a.email === address,
    );
    if (!account) {
      throw new Error(`No mail account ${address} linked to Gmail in Minerva`);
    }
    const started = Date.now();
    const mailbox = (options.open ?? ((e) => this.gmail.mailbox(e)))(address);
    const ids = await mailbox.messageIds("INBOX");
    const report: GmailSuggestInboxReport = {
      accountId: account.id,
      inbox: ids.length,
      suggested: 0,
      gone: 0,
      failed: 0,
      noModel: false,
      requests: 0,
      seconds: 0,
    };

    let pending: ClassifierMessage[] = [];
    const flush = async () => {
      if (pending.length === 0 || report.noModel) return;
      const sent = pending;
      pending = [];
      try {
        const recorded = await this.messages.suggest(account.id, sent);
        if (recorded === undefined) report.noModel = true;
        else report.suggested += recorded;
      } catch (error) {
        report.failed += sent.length;
        this.logger.warn(
          `Could not score ${sent.length} messages: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    let done = 0;
    for (const id of ids) {
      if (report.noModel) break;
      try {
        const raw = await mailbox.raw(id);
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
          this.logger.warn(
            `Could not read message ${id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      options.onProgress?.(++done, ids.length);
    }
    await flush();
    report.requests = mailbox.requests;
    report.seconds = Math.round((Date.now() - started) / 1000);
    return report;
  }
}
