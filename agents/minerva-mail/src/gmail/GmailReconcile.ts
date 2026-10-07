import { MailApi } from "@ncfritz/olympus-client";
import { Injectable, Logger } from "@nestjs/common";
import { GmailClient, gmailStatusOf, type GmailMailbox } from "./GmailClient";
import { GmailMessages } from "./GmailMessages";
import {
  applyLabel,
  CATEGORY,
  emptyState,
  FLAG_LABELS,
  FLAG_NAMES,
  type GmailState,
  LEFT_OUT,
  readStarIcons,
  sortState,
  stateOfLabelIds,
  withStarIcon,
} from "./gmailState";

/** Outside All Mail or left out: counted, for comparing with the totals. */
const EXCLUDED = {
  spam: "SPAM",
  trash: "TRASH",
  drafts: "DRAFT",
  chats: "CHAT",
};

/** How many label changes to name in the report, most frequent first. */
const TOP_LABEL_CHANGES = 15;

type Totals = { messages: number; threads: number };

export type GmailReconcileOptions = {
  onProgress?: (stage: string, done: number, of?: number) => void;
};

/** What a reconcile did: counts only, never content. */
export type GmailReconcileReport = {
  accountId: string;
  historyId: string;
  gmail: {
    messagesTotal: number;
    threadsTotal: number;
    kept: number;
    /** Gmail API requests this run sent, retries included. */
    requests: number;
    /** Gmail's own counts for what Minerva leaves out (null: no such label). */
    excluded: Record<keyof typeof EXCLUDED, Totals | null>;
  };
  labels: { matched: number; created: number; notInGmail: string[] };
  /** Starred messages by icon (Gmail's searches), and those none found. */
  stars: {
    starred: number;
    byIcon: Record<string, number>;
    withoutIcon: number;
  };
  minerva: { messages: number };
  unchanged: number;
  relabelled: number;
  /** Of the relabelled, how many differed in each part. */
  differences: {
    labels: number;
    categories: number;
    flags: Record<string, number>;
    starIcon: number;
  };
  /** The labels most often added or removed, with how many messages. */
  labelChanges: { label: string; added: number; removed: number }[];
  deleted: number;
  /**
   * In Minerva but not in Gmail's list, yet in Gmail when asked: mail that
   * arrived after the list was read (history polling added it). Kept.
   */
  arrivedDuringRun: number;
  added: number;
  /** New mail's text sent to the classifier; and what it refused. */
  featurized: number;
  featurizeFailed: number;
  /** New mail scored, its suggestions recorded; and what failed. */
  suggested: number;
  suggestFailed: number;
  failed: number;
  seconds: number;
};

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Brings a linked mailbox into step with Gmail (docs/plans/
 * email-management phase 1b): the labels get their Gmail IDs; every
 * message's labels and flags are read from Gmail a label at a time
 * (messages.list, 500 IDs a call) and compared with Minerva's; a message
 * whose differ gets `message.labels`, one Gmail no longer has gets
 * `message.delete`, and one Minerva lacks is fetched whole (format raw,
 * parsed as the import parses) and gets `message.upsert`. Last, the
 * historyId taken at the start is recorded, for history polling to carry
 * on from, with Gmail's totals.
 *
 * Read-only on Gmail. Safe to run again: a second run finds nothing to do,
 * and one cut short is finished by running it again.
 */
@Injectable()
export class GmailReconcile {
  private readonly logger = new Logger(GmailReconcile.name);

  constructor(
    private readonly mail: MailApi,
    private readonly gmail: GmailClient,
    private readonly messages: GmailMessages,
  ) {}

  async run(
    email: string,
    options: GmailReconcileOptions = {},
    mailbox: GmailMailbox = this.gmail.mailbox(email),
  ): Promise<GmailReconcileReport> {
    const started = Date.now();
    const progress = options.onProgress ?? (() => undefined);
    const address = email.trim().toLowerCase();
    const account = (await this.mail.listMailSyncAccounts()).find(
      (a) => a.email === address,
    );
    if (!account) {
      throw new Error(`No mail account ${address} linked to Gmail in Minerva`);
    }

    const profile = await mailbox.profile();
    if (profile.emailAddress.toLowerCase() !== address) {
      throw new Error(
        `The credential for ${address} reads another mailbox; link it again`,
      );
    }
    const snapshotTime = new Date().toISOString();
    const excluded = {} as Record<keyof typeof EXCLUDED, Totals | null>;
    for (const [name, id] of Object.entries(EXCLUDED)) {
      try {
        const t = await mailbox.labelTotals(id);
        excluded[name as keyof typeof EXCLUDED] = {
          messages: t.messagesTotal,
          threads: t.threadsTotal,
        };
      } catch {
        excluded[name as keyof typeof EXCLUDED] = null;
      }
    }

    // Labels first, so every name a message carries is known.
    const labels = await mailbox.labels();
    const synced = await this.mail.syncMailLabels(
      account.id,
      labels.map((l) => ({ gmailLabelId: l.id, name: l.name, type: l.type })),
    );

    // Gmail's state of every message, a label at a time.
    const kept = new Set(await mailbox.messageIds());
    progress("listed", kept.size);
    for (const id of LEFT_OUT) {
      for (const m of await mailbox.messageIds(id)) kept.delete(m);
    }
    const states = new Map<string, GmailState>();
    const stateOf = (id: string): GmailState => {
      let s = states.get(id);
      if (!s) {
        s = emptyState();
        states.set(id, s);
      }
      return s;
    };
    const tracked = labels.filter(
      (l) => l.type === "user" || FLAG_LABELS[l.id] || CATEGORY.test(l.id),
    );
    let done = 0;
    for (const label of tracked) {
      for (const id of await mailbox.messageIds(label.id)) {
        if (!kept.has(id)) continue;
        applyLabel(stateOf(id), label);
      }
      progress("labels", ++done, tracked.length);
    }
    for (const s of states.values()) sortState(s);

    // Which icon each starred message has: one search per icon.
    const icons = await readStarIcons(mailbox);
    const stars = {
      starred: 0,
      byIcon: {} as Record<string, number>,
      withoutIcon: 0,
    };
    for (const [id, s] of states) {
      withStarIcon(s, id, icons);
      if (!s.flags.starred) continue;
      stars.starred++;
      if (s.starIcon) {
        stars.byIcon[s.starIcon] = (stars.byIcon[s.starIcon] ?? 0) + 1;
      } else {
        stars.withoutIcon++;
      }
    }
    progress("stars", stars.starred);

    const report: GmailReconcileReport = {
      accountId: account.id,
      historyId: profile.historyId,
      gmail: {
        messagesTotal: profile.messagesTotal,
        threadsTotal: profile.threadsTotal,
        kept: kept.size,
        requests: 0,
        excluded,
      },
      labels: synced,
      stars,
      minerva: { messages: 0 },
      unchanged: 0,
      relabelled: 0,
      differences: {
        labels: 0,
        categories: 0,
        flags: emptyCounts(),
        starIcon: 0,
      },
      labelChanges: [],
      deleted: 0,
      arrivedDuringRun: 0,
      added: 0,
      featurized: 0,
      featurizeFailed: 0,
      suggested: 0,
      suggestFailed: 0,
      failed: 0,
      seconds: 0,
    };

    // Minerva's state, compared message by message.
    const absent: string[] = [];
    const changes = new Map<string, { added: number; removed: number }>();
    const seen = new Set<string>();
    let after: string | undefined;
    do {
      const page = await this.mail.listMailMessageStates(account.id, after);
      for (const m of page.messages) {
        report.minerva.messages++;
        seen.add(m.gmailId);
        if (!kept.has(m.gmailId)) {
          // Gone, or newer than the list: asked below, once the list is done.
          absent.push(m.gmailId);
          continue;
        }
        const g = states.get(m.gmailId) ?? emptyState();
        const theirs = m.flags as unknown as Record<string, boolean>;
        const flagsDiffering = FLAG_NAMES.filter(
          (f) => g.flags[f] !== theirs[f],
        );
        const labelsSame = sameList(g.labels, m.labels);
        const categoriesSame = sameList(g.categories, m.categories);
        const iconSame =
          (g.flags.starred ? (g.starIcon ?? undefined) : undefined) ===
          (m.starIcon ?? undefined);
        if (
          !flagsDiffering.length &&
          labelsSame &&
          categoriesSame &&
          iconSame
        ) {
          report.unchanged++;
          continue;
        }
        for (const f of flagsDiffering) report.differences.flags[f]++;
        if (!categoriesSame) report.differences.categories++;
        if (!iconSame) report.differences.starIcon++;
        if (!labelsSame) {
          report.differences.labels++;
          const before = new Set(m.labels);
          const after = new Set(g.labels);
          for (const l of after) if (!before.has(l)) count(changes, l).added++;
          for (const l of before)
            if (!after.has(l)) count(changes, l).removed++;
        }
        await this.messages.publishLabels(
          account.id,
          m.gmailId,
          g,
          snapshotTime,
        );
        report.relabelled++;
      }
      after = page.nextCursor;
      progress("compared", report.minerva.messages);
    } while (after);

    // A message Minerva has and Gmail's list had not is deleted only once
    // Gmail says it is gone, or in Spam, Trash, the drafts or chats. Mail
    // that arrived during the run (history polling adds it while this
    // runs) is kept.
    const labelsById = new Map(labels.map((l) => [l.id, l]));
    for (const id of absent) {
      try {
        let current: { labelIds?: string[] } | undefined;
        try {
          current = await mailbox.minimal(id);
        } catch (error) {
          if (gmailStatusOf(error) !== 404) throw error;
        }
        if (current && stateOfLabelIds(current.labelIds ?? [], labelsById)) {
          report.arrivedDuringRun++;
          continue;
        }
        await this.messages.publishDelete(account.id, id, snapshotTime);
        report.deleted++;
      } catch (error) {
        report.failed++;
        this.logger.warn(
          `Could not check message ${id} before deleting it: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    report.labelChanges = [...changes]
      .map(([label, c]) => ({ label, ...c }))
      .sort(
        (a, b) =>
          b.added + b.removed - (a.added + a.removed) ||
          a.label.localeCompare(b.label),
      )
      .slice(0, TOP_LABEL_CHANGES);

    // What Minerva lacks: mail since the archive, fetched whole.
    const missing = [...kept].filter((id) => !seen.has(id));
    const batch = this.messages.batch(account.id);
    done = 0;
    for (const id of missing) {
      try {
        const outcome = await batch.add(
          mailbox,
          id,
          (): GmailState => states.get(id) ?? emptyState(),
        );
        if (outcome === "added") report.added++;
      } catch (error) {
        report.failed++;
        this.logger.warn(
          `Could not fetch message ${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      progress("added", ++done, missing.length);
    }
    await batch.flush();
    report.featurized = batch.featurized;
    report.featurizeFailed = batch.featurizeFailed;
    report.suggested = batch.suggested;
    report.suggestFailed = batch.suggestFailed;

    // Recorded only once everything above is published: a run cut short
    // leaves the last historyId, and runs again.
    if (report.failed === 0) {
      await this.mail.updateMailAccountSync(account.id, {
        historyId: profile.historyId,
        messagesTotal: profile.messagesTotal,
        threadsTotal: profile.threadsTotal,
      });
    }
    report.gmail.requests = mailbox.requests;
    report.seconds = Math.round((Date.now() - started) / 1000);
    return report;
  }
}

const emptyCounts = (): Record<string, number> => ({
  inbox: 0,
  unread: 0,
  starred: 0,
  important: 0,
  sent: 0,
});

const count = (
  changes: Map<string, { added: number; removed: number }>,
  label: string,
) => {
  let c = changes.get(label);
  if (!c) {
    c = { added: 0, removed: 0 };
    changes.set(label, c);
  }
  return c;
};
