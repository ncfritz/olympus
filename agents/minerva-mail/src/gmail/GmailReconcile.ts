import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { MailApi } from "@ncfritz/olympus-client";
import { publishMessage } from "@ncfritz/olympus-messages";
import { Injectable, Logger } from "@nestjs/common";
import { mailMessageRoute } from "../messaging";
import type { MailFlags } from "../sources/MailSourceMessage";
import { parseRawMessage } from "../sources/parseRawMessage";
import { noFlags } from "../sources/takeout/takeoutLabels";
import { toMetadataMessage } from "../takeout/toMetadataMessage";
import {
  GmailClient,
  type GmailLabelInfo,
  type GmailMailbox,
} from "./GmailClient";

/** Gmail's system labels Minerva keeps as flags. */
const FLAG_LABELS: Record<string, keyof MailFlags> = {
  INBOX: "inbox",
  UNREAD: "unread",
  STARRED: "starred",
  IMPORTANT: "important",
  SENT: "sent",
};
const CATEGORY = /^CATEGORY_([A-Z]+)$/;

/** Not mail Minerva keeps, as the import skipped them. */
const LEFT_OUT = ["DRAFT", "CHAT"];

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
    /** Gmail's own counts for what Minerva leaves out (null: no such label). */
    excluded: Record<keyof typeof EXCLUDED, Totals | null>;
  };
  labels: { matched: number; created: number; notInGmail: string[] };
  minerva: { messages: number };
  unchanged: number;
  relabelled: number;
  /** Of the relabelled, how many differed in each part. */
  differences: {
    labels: number;
    categories: number;
    flags: Record<string, number>;
  };
  /** The labels most often added or removed, with how many messages. */
  labelChanges: { label: string; added: number; removed: number }[];
  deleted: number;
  added: number;
  failed: number;
  seconds: number;
};

/** A message's labels, categories and flags as Gmail has them. */
type GmailState = {
  labels: string[];
  categories: string[];
  flags: Record<string, boolean>;
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
    private readonly amqp: AmqpConnection,
    private readonly mail: MailApi,
    private readonly gmail: GmailClient,
  ) {}

  async run(
    email: string,
    options: GmailReconcileOptions = {},
    mailbox: GmailMailbox = this.gmail.mailbox(email),
  ): Promise<GmailReconcileReport> {
    const started = Date.now();
    const progress = options.onProgress ?? (() => undefined);
    const address = email.trim().toLowerCase();
    const account = (await this.mail.listMailTrainingAccounts()).find(
      (a) => a.email === address,
    );
    if (!account) throw new Error(`No mail account ${address} in Minerva`);

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
        s = { labels: [], categories: [], flags: emptyFlags() };
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
        apply(stateOf(id), label);
      }
      progress("labels", ++done, tracked.length);
    }
    for (const s of states.values()) {
      s.labels.sort();
      s.categories.sort();
    }

    const report: GmailReconcileReport = {
      accountId: account.id,
      historyId: profile.historyId,
      gmail: {
        messagesTotal: profile.messagesTotal,
        threadsTotal: profile.threadsTotal,
        kept: kept.size,
        excluded,
      },
      labels: synced,
      minerva: { messages: 0 },
      unchanged: 0,
      relabelled: 0,
      differences: { labels: 0, categories: 0, flags: emptyCounts() },
      labelChanges: [],
      deleted: 0,
      added: 0,
      failed: 0,
      seconds: 0,
    };

    // Minerva's state, compared message by message.
    const changes = new Map<string, { added: number; removed: number }>();
    const seen = new Set<string>();
    let after: string | undefined;
    do {
      const page = await this.mail.listMailMessageStates(account.id, after);
      for (const m of page.messages) {
        report.minerva.messages++;
        seen.add(m.gmailId);
        if (!kept.has(m.gmailId)) {
          await this.publish("delete", {
            accountId: account.id,
            source: "gmail",
            snapshotTime,
            gmailId: m.gmailId,
          });
          report.deleted++;
          continue;
        }
        const g = states.get(m.gmailId) ?? {
          labels: [],
          categories: [],
          flags: emptyFlags(),
        };
        const theirs = m.flags as unknown as Record<string, boolean>;
        const flagsDiffering = Object.keys(FLAG_NAMES).filter(
          (f) => g.flags[f] !== theirs[f],
        );
        const labelsSame = sameList(g.labels, m.labels);
        const categoriesSame = sameList(g.categories, m.categories);
        if (!flagsDiffering.length && labelsSame && categoriesSame) {
          report.unchanged++;
          continue;
        }
        for (const f of flagsDiffering) report.differences.flags[f]++;
        if (!categoriesSame) report.differences.categories++;
        if (!labelsSame) {
          report.differences.labels++;
          const before = new Set(m.labels);
          const after = new Set(g.labels);
          for (const l of after) if (!before.has(l)) count(changes, l).added++;
          for (const l of before)
            if (!after.has(l)) count(changes, l).removed++;
        }
        await this.publish("labels", {
          accountId: account.id,
          source: "gmail",
          snapshotTime,
          gmailId: m.gmailId,
          labels: g.labels,
          categories: g.categories,
          flags: toFlags(g.flags),
        });
        report.relabelled++;
      }
      after = page.nextCursor;
      progress("compared", report.minerva.messages);
    } while (after);

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
    done = 0;
    for (const id of missing) {
      try {
        const raw = await mailbox.raw(id);
        const g = states.get(id) ?? {
          labels: [],
          categories: [],
          flags: emptyFlags(),
        };
        const { message } = await parseRawMessage(
          Buffer.from(raw.raw, "base64url"),
          {
            gmailId: raw.id,
            threadId: raw.threadId,
            receivedAt: new Date(Number(raw.internalDate)).toISOString(),
            labels: g.labels,
            flags: { ...noFlags(), ...toFlags(g.flags) },
            categories: g.categories,
          },
        );
        await this.publish(
          "upsert",
          toMetadataMessage(message, account.id, "gmail", new Date()),
        );
        report.added++;
      } catch (error) {
        report.failed++;
        this.logger.warn(
          `Could not fetch message ${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      progress("added", ++done, missing.length);
    }

    // Recorded only once everything above is published: a run cut short
    // leaves the last historyId, and runs again.
    if (report.failed === 0) {
      await this.mail.updateMailAccountSync(account.id, {
        historyId: profile.historyId,
        messagesTotal: profile.messagesTotal,
        threadsTotal: profile.threadsTotal,
      });
    }
    report.seconds = Math.round((Date.now() - started) / 1000);
    return report;
  }

  private async publish(
    action: "upsert" | "labels" | "delete",
    message: unknown,
  ): Promise<void> {
    await publishMessage(
      this.amqp,
      mailMessageRoute(action),
      message as never,
      {
        persistent: true,
        contentType: "application/json",
      },
    );
  }
}

const FLAG_NAMES: Record<string, true> = {
  inbox: true,
  unread: true,
  starred: true,
  important: true,
  sent: true,
};

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

const emptyFlags = (): Record<string, boolean> => ({
  inbox: false,
  unread: false,
  starred: false,
  important: false,
  sent: false,
});

const toFlags = (flags: Record<string, boolean>) => ({
  inbox: flags.inbox,
  unread: flags.unread,
  starred: flags.starred,
  important: flags.important,
  sent: flags.sent,
});

/** What carrying `label` makes of a message's state. */
const apply = (state: GmailState, label: GmailLabelInfo): void => {
  const flag = FLAG_LABELS[label.id];
  if (flag) {
    state.flags[flag] = true;
    return;
  }
  const category = CATEGORY.exec(label.id);
  if (category) {
    state.categories.push(category[1].toLowerCase());
    return;
  }
  if (label.type === "user") state.labels.push(label.name);
};
