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
import type {
  GmailWriteChange,
  GmailWriteLabelOp,
  StartGmailWritesRequest,
} from "../model/gmail";
import {
  BATCH_MODIFY_IDS,
  GmailClient,
  type GmailLabelInfo,
  type GmailMailbox,
  gmailStatusOf,
} from "./GmailClient";
import { GmailCredentialStore } from "./GmailCredentialStore";
import { GmailMessages } from "./GmailMessages";
import { NOT_KEPT, stateOfLabelIds, WRITABLE_FLAGS } from "./gmailState";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GMAIL_ID = /^[0-9a-f]{1,16}$/;
const LABEL_ID = /^[A-Za-z0-9_-]{1,100}$/;
/** As many as a merge moves at most. */
export const MAX_WRITES = 50_000;
/** Outcomes reported to the API at a time while a batch runs. */
const REPORT_EVERY = 500;
const REPORT_TRIES = 3;

/** What became of one change: MailChangeStatus, less pending. */
export type GmailWriteOutcome =
  "written" | "unchanged" | "changed" | "gone" | "failed";

/** What became of a label operation, as reported to the API. */
type LabelOpOutcome = {
  op: GmailWriteLabelOp["op"];
  name: string;
  status: "done" | "skipped" | "failed";
  gmailLabelId?: string;
  detail?: string;
};

/** What a batch did: counts only. */
export type GmailWriteReport = {
  batchId: string;
  status: "done" | "failed";
  counts: Record<GmailWriteOutcome, number>;
  labelOps: Record<LabelOpOutcome["status"], number>;
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
      labelOps?: LabelOpOutcome[];
    }) => Promise<void>,
  ) {}

  readonly labelOps: Record<LabelOpOutcome["status"], number> = {
    done: 0,
    skipped: 0,
    failed: 0,
  };

  /** Label operations' outcomes, sent at once with what is pending. */
  async labels(outcomes: LabelOpOutcome[], status: "running" | "done") {
    for (const o of outcomes) this.labelOps[o.status]++;
    const changes = this.pending;
    this.pending = [];
    await this.send({ status, changes, labelOps: outcomes });
  }

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
 * background. A change may take INBOX or UNREAD off (archive, mark read)
 * or put them back, as well as the user's labels. Each message is read
 * first (format minimal): one gone, or in Spam, Trash, the drafts or
 * chats, is gone; one whose labels and flags are already those wanted is
 * unchanged; one whose labels are not those the
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
      const readLabels = async () =>
        new Map((await mailbox.labels()).map((l) => [l.id, l] as const));
      let labels = await readLabels();
      const ops = request.labelOps ?? [];

      // Creates and renames first, reported before any message is written,
      // so Minerva has the names the messages arrive with.
      const before = await this.labelsBefore(ops, mailbox, labels);
      const renames = new Map(
        before
          .filter((o) => o.op === "rename" && o.status === "done")
          .map((o) => [
            o.name,
            ops.find((x) => x.op === "rename" && x.name === o.name)
              ?.newName as string,
          ]),
      );
      if (before.length) {
        labels = await readLabels();
        await reporter.labels(before, "running");
      }

      await this.writeChanges(request, mailbox, labels, reporter, renames);

      // Deletes last, once Gmail says the label is empty.
      const after = await this.labelsAfter(ops, mailbox, labels, renames);
      if (after.length) {
        await reporter.labels(after, "done");
      } else {
        await reporter.flush("done");
      }
      this.logger.log(
        `Change batch ${batchId}: ${reporter.counts.written} written, ${reporter.counts.unchanged} unchanged, ${reporter.counts.changed} changed in Gmail, ${reporter.counts.gone} gone, ${reporter.counts.failed} failed; labels ${reporter.labelOps.done} changed, ${reporter.labelOps.skipped} skipped, ${reporter.labelOps.failed} failed`,
      );
      return {
        batchId,
        status: "done",
        counts: reporter.counts,
        labelOps: reporter.labelOps,
      };
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
        labelOps: reporter.labelOps,
        error: message,
      };
    }
  }

  /** The batch's creates, then its renames. */
  private async labelsBefore(
    ops: GmailWriteLabelOp[],
    mailbox: GmailMailbox,
    labels: Map<string, GmailLabelInfo>,
  ): Promise<LabelOpOutcome[]> {
    const outcomes: LabelOpOutcome[] = [];
    const byName = (name: string) =>
      [...labels.values()].find((l) => l.name === name);
    for (const o of ops.filter((x) => x.op === "create")) {
      const existing = byName(o.name);
      if (existing) {
        outcomes.push({
          op: "create",
          name: o.name,
          status: "done",
          gmailLabelId: existing.id,
          detail: "Gmail had it already",
        });
        continue;
      }
      try {
        const made = await mailbox.createLabel(o.name);
        labels.set(made.id, made);
        outcomes.push({
          op: "create",
          name: o.name,
          status: "done",
          gmailLabelId: made.id,
        });
      } catch (error) {
        outcomes.push({
          op: "create",
          name: o.name,
          status: "failed",
          detail: messageOf(error),
        });
      }
    }
    for (const o of ops.filter((x) => x.op === "rename")) {
      const label =
        (o.gmailLabelId ? labels.get(o.gmailLabelId) : undefined) ??
        byName(o.name);
      const fail = (detail: string): LabelOpOutcome => ({
        op: "rename",
        name: o.name,
        status: "failed",
        detail,
      });
      if (!label || label.type !== "user") {
        outcomes.push(fail(`Gmail has no label ${o.name}`));
        continue;
      }
      if (!o.newName || byName(o.newName)) {
        outcomes.push(fail(`Gmail has a label ${o.newName} already`));
        continue;
      }
      try {
        await mailbox.renameLabel(label.id, o.newName);
        labels.set(label.id, { ...label, name: o.newName });
        outcomes.push({ op: "rename", name: o.name, status: "done" });
      } catch (error) {
        outcomes.push(fail(messageOf(error)));
      }
    }
    return outcomes;
  }

  /** The batch's deletes, each only once Gmail says its label is empty. */
  private async labelsAfter(
    ops: GmailWriteLabelOp[],
    mailbox: GmailMailbox,
    labels: Map<string, GmailLabelInfo>,
    renames: Map<string, string>,
  ): Promise<LabelOpOutcome[]> {
    const outcomes: LabelOpOutcome[] = [];
    for (const o of ops.filter((x) => x.op === "delete")) {
      const name = renames.get(o.name) ?? o.name;
      const label =
        (o.gmailLabelId ? labels.get(o.gmailLabelId) : undefined) ??
        [...labels.values()].find((l) => l.name === name);
      if (!label || label.type !== "user") {
        outcomes.push({
          op: "delete",
          name: o.name,
          status: "skipped",
          detail: `Gmail has no label ${name}`,
        });
        continue;
      }
      try {
        const totals = await mailbox.labelTotals(label.id);
        if (totals.messagesTotal > 0) {
          outcomes.push({
            op: "delete",
            name: o.name,
            status: "skipped",
            detail: `Still has ${totals.messagesTotal} messages in Gmail`,
          });
          continue;
        }
        await mailbox.deleteLabel(label.id);
        outcomes.push({ op: "delete", name: o.name, status: "done" });
      } catch (error) {
        outcomes.push({
          op: "delete",
          name: o.name,
          status: "failed",
          detail: messageOf(error),
        });
      }
    }
    return outcomes;
  }

  private async writeChanges(
    request: StartGmailWritesRequest,
    mailbox: GmailMailbox,
    labels: Map<string, GmailLabelInfo>,
    reporter: Reporter,
    renames: Map<string, string> = new Map(),
  ): Promise<void> {
    const snapshotTime = new Date().toISOString();
    // A label the batch created is found by name; one it could not make
    // leaves its changes failed.
    const idOf = (l: { name: string; gmailLabelId?: string }) =>
      WRITABLE_FLAGS.has(l.name)
        ? l.name
        : (l.gmailLabelId ??
          [...labels.values()].find(
            (x) => x.name === l.name && x.type === "user",
          )?.id);
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
        // What the API recorded, in the names the batch's renames gave.
        // Flags (archiving, marking read) are not guarded: a message's read
        // state changes all the time, and taking a flag off is safe.
        const expected = change.expected.map((n) => renames.get(n) ?? n);
        const isFlag = (l: { name: string }) => WRITABLE_FLAGS.has(l.name);
        const removing = change.remove
          .filter((l) => !isFlag(l))
          .map((l) => l.name);
        const wanted = [
          ...expected.filter((n) => !removing.includes(n)),
          ...change.add.filter((l) => !isFlag(l)).map((l) => l.name),
        ];
        const flagsDone =
          change.add.filter(isFlag).every((l) => labelIds.includes(l.name)) &&
          change.remove.filter(isFlag).every((l) => !labelIds.includes(l.name));
        if (sameSet(now, wanted) && flagsDone) {
          await reporter.add(change.gmailId, "unchanged");
          continue;
        }
        if (!sameSet(now, expected)) {
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
        const addIds = change.add.map(idOf);
        const removeIds = change.remove.map(idOf);
        if ([...addIds, ...removeIds].some((id) => !id)) {
          this.logger.warn(
            `Change batch ${request.batchId}: a label for message ${change.gmailId} is not in Gmail`,
          );
          await reporter.add(change.gmailId, "failed");
          continue;
        }
        const add = (addIds as string[]).sort();
        const remove = (removeIds as string[]).sort();
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
  const ops = request.labelOps ?? [];
  if (!Array.isArray(ops) || ops.length > 1000) {
    throw new BadRequestException("labelOps must be at most 1,000 operations");
  }
  ops.forEach((o, i) => {
    const ok =
      o &&
      ["create", "rename", "delete"].includes(o.op) &&
      typeof o.name === "string" &&
      o.name.length > 0 &&
      (o.op === "rename") === (typeof o.newName === "string") &&
      (o.gmailLabelId === undefined ||
        (typeof o.gmailLabelId === "string" && LABEL_ID.test(o.gmailLabelId)));
    if (!ok) {
      throw new BadRequestException(
        `labelOps[${i}] must be a create, rename (with its new name) or delete of a named label`,
      );
    }
  });
  if (
    !Array.isArray(changes) ||
    changes.length + ops.length < 1 ||
    changes.length > MAX_WRITES
  ) {
    throw new BadRequestException(
      `changes must be at most ${MAX_WRITES}, and a batch changes something`,
    );
  }
  const creating = new Set(
    ops.filter((o) => o.op === "create").map((o) => o.name),
  );
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
              (typeof l.gmailLabelId === "string"
                ? LABEL_ID.test(l.gmailLabelId)
                : creating.has(l.name)),
          ),
      ) &&
      c.add.length + c.remove.length > 0;
    if (!ok) {
      throw new BadRequestException(
        `changes[${i}] must have a Gmail ID, the labels expected, and labels to add or remove with their Gmail IDs (or created by the batch)`,
      );
    }
  });
};
