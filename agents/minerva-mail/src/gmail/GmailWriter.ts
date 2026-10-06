import { MailApi } from "@ncfritz/olympus-client";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  GMAIL_MODIFY_SCOPE,
  gmailConfig,
  type GmailConfigType,
} from "../config/configuration";
import type { GmailWriteChange, StartGmailWritesRequest } from "../model/gmail";
import {
  BATCH_MODIFY_IDS,
  GmailClient,
  type GmailLabelInfo,
  type GmailMailbox,
  gmailStatusOf,
} from "./GmailClient";
import { GmailCredentialStore } from "./GmailCredentialStore";
import { GmailMessages } from "./GmailMessages";
import { NOT_KEPT, stateOfLabelIds } from "./gmailState";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GMAIL_ID = /^[0-9a-f]{1,16}$/;
const LABEL_ID = /^[A-Za-z0-9_-]{1,100}$/;
export const MAX_WRITES = 10_000;
/** Outcomes reported to the API at a time while a batch runs. */
const REPORT_EVERY = 500;
const REPORT_TRIES = 3;

/** What became of one change: MailChangeStatus, less pending. */
export type GmailWriteOutcome =
  "written" | "unchanged" | "changed" | "gone" | "failed";

/** What a batch did: counts only. */
export type GmailWriteReport = {
  batchId: string;
  status: "done" | "failed";
  counts: Record<GmailWriteOutcome, number>;
  error?: string;
};

const sameSet = (a: string[], b: string[]) => {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((v) => y.has(v));
};

const messageOf = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 500);

/** Outcomes, sent to the API a few hundred at a time. */
class Reporter {
  private pending: { gmailId: string; status: GmailWriteOutcome }[] = [];
  readonly counts: Record<GmailWriteOutcome, number> = {
    written: 0,
    unchanged: 0,
    changed: 0,
    gone: 0,
    failed: 0,
  };

  constructor(
    private readonly send: (report: {
      status: "running" | "done" | "failed";
      error?: string;
      changes?: { gmailId: string; status: GmailWriteOutcome }[];
    }) => Promise<void>,
  ) {}

  async add(gmailId: string, status: GmailWriteOutcome): Promise<void> {
    this.counts[status]++;
    this.pending.push({ gmailId, status });
    if (this.pending.length >= REPORT_EVERY) await this.flush("running");
  }

  async flush(status: "running" | "done", error?: string): Promise<void> {
    const changes = this.pending;
    this.pending = [];
    await this.send({ status, ...(error ? { error } : {}), changes });
  }

  async fail(error: string): Promise<void> {
    const changes = this.pending;
    this.pending = [];
    // What is known is recorded first; then the batch fails.
    if (changes.length) await this.send({ status: "running", changes });
    await this.send({ status: "failed", error });
  }
}

/**
 * Writes the API's batches of label changes to Gmail (docs/plans/
 * email-management phase 4; ADR 0030), one batch at a time, in the
 * background. Each message is read first (format minimal): one gone, or
 * in Spam, Trash, the drafts or chats, is gone; one whose user labels are
 * already those wanted is unchanged; one whose labels are not those the
 * API recorded was changed in Gmail since, and is synced to Minerva again
 * instead of written, so a change made by hand is never overwritten. The
 * rest are written with messages.batchModify, those with the same change
 * together, 1,000 a call, and published to Minerva as written. Outcomes go
 * back to the API (UpdateMailChangeBatch) as they are known.
 */
@Injectable()
export class GmailWriter {
  private readonly logger = new Logger(GmailWriter.name);
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(gmailConfig.KEY) private readonly config: GmailConfigType,
    private readonly mail: MailApi,
    private readonly gmail: GmailClient,
    private readonly credentials: GmailCredentialStore,
    private readonly messages: GmailMessages,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.clientId && this.config.writesEnabled);
  }

  /**
   * Checks a batch and queues it behind any being written.
   *
   * @throws BadRequestException the batch is not what it should be
   */
  accept(request: StartGmailWritesRequest): number {
    validate(request);
    this.queue = this.queue.then(() =>
      this.write(request).catch((error: unknown) => {
        this.logger.error(
          `Change batch ${request.batchId} stopped: ${messageOf(error)}`,
        );
      }),
    );
    return request.changes.length;
  }

  /** Waits for every batch queued so far (for shutdown, and tests). */
  async idle(): Promise<void> {
    await this.queue;
  }

  async write(
    request: StartGmailWritesRequest,
    open: (email: string) => GmailMailbox = (email) =>
      this.gmail.mailbox(email),
  ): Promise<GmailWriteReport> {
    const { batchId } = request;
    const reporter = new Reporter((report) => this.report(batchId, report));
    try {
      await this.report(batchId, { status: "running" });
      const credential = this.credentials.load(request.email);
      if (!credential?.scope.split(" ").includes(GMAIL_MODIFY_SCOPE)) {
        throw new Error(
          "The mailbox is linked for reading only: allow changes from the Inbox first",
        );
      }
      const mailbox = open(request.email);
      const labels = new Map(
        (await mailbox.labels()).map((l) => [l.id, l] as const),
      );
      await this.writeChanges(request, mailbox, labels, reporter);
      await reporter.flush("done");
      this.logger.log(
        `Change batch ${batchId}: ${reporter.counts.written} written, ${reporter.counts.unchanged} unchanged, ${reporter.counts.changed} changed in Gmail, ${reporter.counts.gone} gone, ${reporter.counts.failed} failed`,
      );
      return { batchId, status: "done", counts: reporter.counts };
    } catch (error) {
      const message = messageOf(error);
      this.logger.warn(`Change batch ${batchId} failed: ${message}`);
      try {
        await reporter.fail(message);
      } catch (reportError) {
        this.logger.error(
          `Could not report change batch ${batchId} failed: ${messageOf(reportError)}`,
        );
      }
      return {
        batchId,
        status: "failed",
        counts: reporter.counts,
        error: message,
      };
    }
  }

  private async writeChanges(
    request: StartGmailWritesRequest,
    mailbox: GmailMailbox,
    labels: Map<string, GmailLabelInfo>,
    reporter: Reporter,
  ): Promise<void> {
    const snapshotTime = new Date().toISOString();
    const userNames = (ids: string[]) =>
      ids
        .map((id) => labels.get(id))
        .filter((l): l is GmailLabelInfo => l?.type === "user")
        .map((l) => l.name);

    // Read each message, and group those to write by their change.
    const groups = new Map<
      string,
      {
        add: string[];
        remove: string[];
        messages: { change: GmailWriteChange; labelIds: string[] }[];
      }
    >();
    for (const change of request.changes) {
      try {
        let labelIds: string[] | undefined;
        try {
          labelIds = (await mailbox.minimal(change.gmailId)).labelIds ?? [];
        } catch (error) {
          if (gmailStatusOf(error) !== 404) throw error;
        }
        if (!labelIds || labelIds.some((id) => NOT_KEPT.has(id))) {
          await this.messages.publishDelete(
            accountOf(request),
            change.gmailId,
            snapshotTime,
          );
          await reporter.add(change.gmailId, "gone");
          continue;
        }
        const now = userNames(labelIds);
        const removing = change.remove.map((l) => l.name);
        const wanted = [
          ...change.expected.filter((n) => !removing.includes(n)),
          ...change.add.map((l) => l.name),
        ];
        if (sameSet(now, wanted)) {
          await reporter.add(change.gmailId, "unchanged");
          continue;
        }
        if (!sameSet(now, change.expected)) {
          // Changed in Gmail since: Minerva is brought up to date instead.
          const state = stateOfLabelIds(labelIds, labels);
          if (state) {
            await this.messages.publishLabels(
              accountOf(request),
              change.gmailId,
              state,
              snapshotTime,
            );
          }
          await reporter.add(change.gmailId, "changed");
          continue;
        }
        const add = change.add.map((l) => l.gmailLabelId).sort();
        const remove = change.remove.map((l) => l.gmailLabelId).sort();
        const key = `${add.join(",")}|${remove.join(",")}`;
        const group = groups.get(key) ?? { add, remove, messages: [] };
        group.messages.push({ change, labelIds });
        groups.set(key, group);
      } catch (error) {
        this.logger.warn(
          `Could not read message ${change.gmailId} for change batch ${request.batchId}: ${messageOf(error)}`,
        );
        await reporter.add(change.gmailId, "failed");
      }
    }

    // Write each group, 1,000 messages a call.
    for (const group of groups.values()) {
      for (let i = 0; i < group.messages.length; i += BATCH_MODIFY_IDS) {
        const chunk = group.messages.slice(i, i + BATCH_MODIFY_IDS);
        try {
          await mailbox.batchModify(
            chunk.map((m) => m.change.gmailId),
            group.add,
            group.remove,
          );
        } catch (error) {
          this.logger.warn(
            `Gmail refused ${chunk.length} changes of batch ${request.batchId}: ${messageOf(error)}`,
          );
          for (const m of chunk) await reporter.add(m.change.gmailId, "failed");
          continue;
        }
        const written = new Date().toISOString();
        for (const m of chunk) {
          const after = [
            ...m.labelIds.filter((id) => !group.remove.includes(id)),
            ...group.add,
          ];
          const state = stateOfLabelIds(after, labels);
          if (state) {
            await this.messages.publishLabels(
              accountOf(request),
              m.change.gmailId,
              state,
              written,
            );
          }
          await reporter.add(m.change.gmailId, "written");
        }
      }
    }
  }

  private async report(
    batchId: string,
    report: Parameters<MailApi["updateMailChangeBatch"]>[1],
  ): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.mail.updateMailChangeBatch(batchId, report);
        return;
      } catch (error) {
        if (attempt >= REPORT_TRIES) throw error;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }
}

/** The account a batch is for, as the API sent it. */
const accountOf = (request: StartGmailWritesRequest): string =>
  request.accountId;

const validate = (request: StartGmailWritesRequest): void => {
  if (
    !request ||
    typeof request.batchId !== "string" ||
    !UUID.test(request.batchId)
  ) {
    throw new BadRequestException("batchId must be a change batch ID");
  }
  if (typeof request.accountId !== "string" || !UUID.test(request.accountId)) {
    throw new BadRequestException("accountId must be a mail account ID");
  }
  if (typeof request.email !== "string" || !request.email.includes("@")) {
    throw new BadRequestException("email must be the mailbox's address");
  }
  const changes = request.changes;
  if (
    !Array.isArray(changes) ||
    changes.length < 1 ||
    changes.length > MAX_WRITES
  ) {
    throw new BadRequestException(`changes must be 1 to ${MAX_WRITES} changes`);
  }
  changes.forEach((c, i) => {
    const ok =
      c &&
      typeof c.gmailId === "string" &&
      GMAIL_ID.test(c.gmailId) &&
      Array.isArray(c.expected) &&
      c.expected.every((n) => typeof n === "string") &&
      [c.add, c.remove].every(
        (labels) =>
          Array.isArray(labels) &&
          labels.every(
            (l) =>
              l &&
              typeof l.name === "string" &&
              typeof l.gmailLabelId === "string" &&
              LABEL_ID.test(l.gmailLabelId),
          ),
      ) &&
      c.add.length + c.remove.length > 0;
    if (!ok) {
      throw new BadRequestException(
        `changes[${i}] must have a Gmail ID, the labels expected, and labels to add or remove with their Gmail IDs`,
      );
    }
  });
};
