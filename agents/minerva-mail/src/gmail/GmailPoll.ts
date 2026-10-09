import { MailApi } from "@ncfritz/olympus-client";
import { Injectable, Logger } from "@nestjs/common";
import {
  GmailClient,
  type GmailHistoryMessage,
  type GmailLabelInfo,
  type GmailMailbox,
  gmailStatusOf,
} from "./GmailClient";
import { GmailMessages } from "./GmailMessages";
import { GmailReconcile } from "./GmailReconcile";
import {
  isStarIconLabel,
  LEFT_OUT,
  readStarIcons,
  stateOfLabelIds,
  withStarIcon,
} from "./gmailState";

/** At most one reconcile an hour per mailbox when polling falls back to one. */
export const RECONCILE_INTERVAL_MS = 60 * 60 * 1000;

/** Labels whose removal can bring a message back into Minerva. */
const RESTORING = new Set(["SPAM", "TRASH"]);

export type GmailPollAccount = {
  id: string;
  email: string;
  historyId?: string;
};

/** What a poll of one mailbox did: counts only, never content. */
export type GmailPollReport = {
  accountId: string;
  outcome:
    "unchanged" | "polled" | "reconciled" | "waiting" | "not-linked" | "failed";
  historyId?: string;
  records: number;
  added: number;
  relabelled: number;
  deleted: number;
  featurized: number;
  featurizeFailed: number;
  /** New mail scored, its suggestions recorded; and what failed. */
  suggested: number;
  suggestFailed: number;
  failed: number;
  requests: number;
};

/** Drafts are saved over and over, and chats are not mail. */
const quiet = (message: GmailHistoryMessage): boolean =>
  (message.labelIds ?? []).some((id) => LEFT_OUT.includes(id));

/**
 * Keeps a reconciled mailbox in step with Gmail (docs/plans/
 * email-management phase 1b step 3): history.list from the historyId
 * recorded last, and for each message it names, the state Gmail has now:
 * new mail (and mail out of Spam or Trash) fetched whole and featurized;
 * labels and flags read with a minimal get; a message gone, or now in Spam,
 * Trash or the drafts, deleted. The historyId history answered with is
 * recorded once everything is published, so a poll cut short is repeated.
 *
 * A mailbox with no historyId yet, or one whose history Gmail no longer
 * has (404, after about a week), is reconciled instead, at most hourly.
 */
@Injectable()
export class GmailPoll {
  private readonly logger = new Logger(GmailPoll.name);
  private readonly labels = new Map<string, Map<string, GmailLabelInfo>>();
  private readonly lastReconcile = new Map<string, number>();

  constructor(
    private readonly mail: MailApi,
    private readonly gmail: GmailClient,
    private readonly messages: GmailMessages,
    private readonly reconcile: GmailReconcile,
  ) {}

  /** Polls every linked mailbox this agent holds a credential for. */
  async pollAll(): Promise<GmailPollReport[]> {
    const reports: GmailPollReport[] = [];
    for (const account of await this.mail.listMailSyncAccounts()) {
      reports.push(await this.pollAccount(account));
    }
    return reports;
  }

  /** Polls the linked mailbox at `email`. */
  async pollOne(email: string): Promise<GmailPollReport> {
    const account = (await this.mail.listMailSyncAccounts()).find(
      (a) => a.email === email,
    );
    if (!account) {
      throw new Error(`No mail account ${email} linked to Gmail in Minerva`);
    }
    return this.pollAccount(account);
  }

  async pollAccount(
    account: GmailPollAccount,
    open: (email: string) => GmailMailbox = (email) =>
      this.gmail.mailbox(email),
  ): Promise<GmailPollReport> {
    const report: GmailPollReport = {
      accountId: account.id,
      outcome: "unchanged",
      records: 0,
      added: 0,
      relabelled: 0,
      deleted: 0,
      featurized: 0,
      featurizeFailed: 0,
      suggested: 0,
      suggestFailed: 0,
      failed: 0,
      requests: 0,
    };
    let mailbox: GmailMailbox;
    try {
      mailbox = open(account.email);
    } catch {
      // Linked through another agent's store, or the credential is gone.
      return { ...report, outcome: "not-linked" };
    }
    const result = await this.poll(account, mailbox, report).catch(
      (error: unknown): GmailPollReport => {
        this.logger.warn(
          `Polling ${account.email} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return { ...report, outcome: "failed", failed: report.failed + 1 };
      },
    );
    if (result.outcome !== "reconciled") result.requests = mailbox.requests;
    return result;
  }

  private async poll(
    account: GmailPollAccount,
    mailbox: GmailMailbox,
    report: GmailPollReport,
  ): Promise<GmailPollReport> {
    if (!account.historyId) {
      return await this.reconcileInstead(account, report);
    }
    let history;
    try {
      history = await mailbox.history(account.historyId);
    } catch (error) {
      if (gmailStatusOf(error) === 404) {
        this.logger.warn(
          `Gmail no longer has ${account.email}'s history from ${account.historyId}; reconciling`,
        );
        return await this.reconcileInstead(account, report);
      }
      throw error;
    }
    report.historyId = history.historyId;
    report.records = history.records.length;
    if (history.historyId === account.historyId) return report;
    report.outcome = "polled";
    await this.apply(account, mailbox, history.records, report);
    if (report.failed === 0) {
      const profile = await mailbox.profile();
      await this.mail.updateMailAccountSync(account.id, {
        historyId: history.historyId,
        messagesTotal: profile.messagesTotal,
        threadsTotal: profile.threadsTotal,
      });
    }
    if (report.added + report.relabelled + report.deleted > 0) {
      this.logger.log(
        `${account.email}: ${report.added} added, ${report.relabelled} relabelled, ${report.deleted} deleted, ${report.failed} failed`,
      );
    }
    return report;
  }

  private async apply(
    account: GmailPollAccount,
    mailbox: GmailMailbox,
    records: Awaited<ReturnType<GmailMailbox["history"]>>["records"],
    report: GmailPollReport,
  ): Promise<void> {
    const added = new Set<string>();
    const deleted = new Set<string>();
    const touched = new Set<string>();
    const labelIds = new Set<string>();
    // A star given or taken: which icon is read by search, once a poll.
    let stars = false;
    for (const record of records) {
      for (const { message } of record.messagesAdded ?? []) {
        if (quiet(message)) continue;
        added.add(message.id);
        deleted.delete(message.id);
        if (message.labelIds?.includes("STARRED")) stars = true;
      }
      for (const { message } of record.messagesDeleted ?? []) {
        if (quiet(message)) continue;
        deleted.add(message.id);
      }
      for (const change of record.labelsAdded ?? []) {
        if (quiet(change.message)) continue;
        touched.add(change.message.id);
        change.labelIds.forEach((id) => labelIds.add(id));
        if (
          change.labelIds.some((id) => id === "STARRED" || isStarIconLabel(id))
        ) {
          stars = true;
        }
      }
      for (const change of record.labelsRemoved ?? []) {
        if (quiet(change.message)) continue;
        touched.add(change.message.id);
        if (
          change.labelIds.some((id) => id === "STARRED" || isStarIconLabel(id))
        ) {
          stars = true;
        }
        if (change.labelIds.some((id) => RESTORING.has(id))) {
          added.add(change.message.id);
        }
      }
    }
    if (added.size + deleted.size + touched.size === 0) return;

    const labels = await this.labelsOf(account, mailbox, labelIds);
    const icons = stars ? await readStarIcons(mailbox) : undefined;
    const stateOf = (id: string) => (ids: string[]) =>
      withStarIcon(stateOfLabelIds(ids, labels), id, icons);
    const snapshotTime = new Date().toISOString();

    for (const id of deleted) {
      await this.messages.publishDelete(account.id, id, snapshotTime);
      report.deleted++;
    }
    const batch = this.messages.batch(account.id);
    for (const id of added) {
      if (deleted.has(id)) continue;
      try {
        const outcome = await batch.add(mailbox, id, stateOf(id));
        if (outcome === "added") {
          report.added++;
        } else {
          await this.messages.publishDelete(account.id, id, snapshotTime);
          report.deleted++;
        }
      } catch (error) {
        this.fail(report, id, error);
      }
    }
    await batch.flush();
    report.featurized = batch.featurized;
    report.featurizeFailed = batch.featurizeFailed;
    report.suggested = batch.suggested;
    report.suggestFailed = batch.suggestFailed;

    for (const id of touched) {
      if (deleted.has(id) || added.has(id)) continue;
      try {
        let current;
        try {
          current = await mailbox.minimal(id);
        } catch (error) {
          if (gmailStatusOf(error) !== 404) throw error;
        }
        const state = current ? stateOf(id)(current.labelIds ?? []) : undefined;
        if (state) {
          await this.messages.publishLabels(
            account.id,
            id,
            state,
            snapshotTime,
          );
          report.relabelled++;
        } else {
          await this.messages.publishDelete(account.id, id, snapshotTime);
          report.deleted++;
        }
      } catch (error) {
        this.fail(report, id, error);
      }
    }
  }

  /**
   * The mailbox's labels by ID, read again (and synced to Minerva) when a
   * change names one not seen yet: a label made in Gmail since.
   */
  private async labelsOf(
    account: GmailPollAccount,
    mailbox: GmailMailbox,
    named: Set<string>,
  ): Promise<Map<string, GmailLabelInfo>> {
    const known = this.labels.get(account.id);
    if (known && [...named].every((id) => known.has(id))) return known;
    const labels = await mailbox.labels();
    await this.mail.syncMailLabels(
      account.id,
      labels.map((l) => ({ gmailLabelId: l.id, name: l.name, type: l.type })),
    );
    const byId = new Map(labels.map((l) => [l.id, l]));
    this.labels.set(account.id, byId);
    return byId;
  }

  private async reconcileInstead(
    account: GmailPollAccount,
    report: GmailPollReport,
  ): Promise<GmailPollReport> {
    const last = this.lastReconcile.get(account.id);
    if (last !== undefined && Date.now() - last < RECONCILE_INTERVAL_MS) {
      return { ...report, outcome: "waiting" };
    }
    this.lastReconcile.set(account.id, Date.now());
    this.logger.log(`Reconciling ${account.email} with Gmail`);
    const result = await this.reconcile.run(account.email);
    this.labels.delete(account.id);
    return {
      ...report,
      outcome: "reconciled",
      historyId: result.historyId,
      added: result.added,
      relabelled: result.relabelled,
      deleted: result.deleted,
      featurized: result.featurized,
      featurizeFailed: result.featurizeFailed,
      suggested: result.suggested,
      suggestFailed: result.suggestFailed,
      failed: result.failed,
      requests: result.gmail.requests,
    };
  }

  private fail(report: GmailPollReport, id: string, error: unknown): void {
    report.failed++;
    this.logger.warn(
      `Could not bring message ${id} up to date: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
