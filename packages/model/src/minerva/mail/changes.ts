import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";
import { MailAuditAction, MailAuditRule } from "./audit";

/*
 * Writes to Gmail (docs/plans/email-management phase 4; ADR 0030, "Changes
 * are reviewed, logged and undoable"): a batch of label changes asked for in
 * the site, written by the mail agent, logged with each message's labels as
 * they were, and undoable; and the decisions taken on proposals.
 */

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** What a batch does. */
export enum MailChangeBatchKind {
  /** Label changes decided in the site. */
  Apply = "apply",
  /** The reverse of an earlier batch. */
  Undo = "undo",
}

/** Where a batch is. */
export enum MailChangeBatchStatus {
  /** Recorded; the agent has not started it. */
  Pending = "pending",
  /** The agent is writing it. */
  Running = "running",
  /** Every change has its outcome. */
  Done = "done",
  /** The batch as a whole could not be written. */
  Failed = "failed",
}

/** What became of one message's change. */
export enum MailChangeStatus {
  /** Not written yet. */
  Pending = "pending",
  /** Written to Gmail. */
  Written = "written",
  /** Gmail already had the labels wanted. */
  Unchanged = "unchanged",
  /** Changed in Gmail since; synced again instead of written. */
  Changed = "changed",
  /** No longer in Gmail, or in Spam or Trash. */
  Gone = "gone",
  /** Gmail refused it. */
  Failed = "failed",
}

/** A batch's changing message status for the agent to report. */
export enum MailChangeBatchReport {
  Running = "running",
  Done = "done",
  Failed = "failed",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** One message's label change, as asked for. */
export class MailLabelChange {
  @ApiProperty({
    type: String,
    required: true,
    description: "The message's Gmail ID, hexadecimal",
  })
  gmailId: string;

  @ApiProperty({
    type: [String],
    required: true,
    description: "User labels to add, by full name",
  })
  add: string[];

  @ApiProperty({
    type: [String],
    required: true,
    description: "User labels to remove, by full name",
  })
  remove: string[];
}

/** How many of a batch's changes have each outcome. */
export class MailChangeCounts {
  @ApiProperty({ type: Number, required: true, description: "Not written yet" })
  pending: number;

  @ApiProperty({ type: Number, required: true, description: "Written" })
  written: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Already as wanted",
  })
  unchanged: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Changed in Gmail since, synced instead",
  })
  changed: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "No longer in Gmail",
  })
  gone: number;

  @ApiProperty({ type: Number, required: true, description: "Refused" })
  failed: number;
}

/** One batch of label changes to Gmail. */
export class MailChangeBatch {
  @ApiProperty({ type: String, required: true, description: "The batch's ID" })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The mail account it changes",
  })
  accountId: string;

  @ApiProperty({
    enum: () => MailChangeBatchKind,
    enumName: "MailChangeBatchKind",
    enumSchema: { description: "What a batch of changes does" },
    required: true,
    description: "An apply or an undo",
  })
  kind: MailChangeBatchKind;

  @ApiProperty({
    type: String,
    required: false,
    description: "For an undo, the batch it reverses",
  })
  undoesBatchId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The undo that reversed this batch, if one has",
  })
  undoneByBatchId?: string;

  @ApiProperty({
    enum: () => MailChangeBatchStatus,
    enumName: "MailChangeBatchStatus",
    enumSchema: { description: "Where a batch of changes is" },
    required: true,
    description: "Where the batch is",
  })
  status: MailChangeBatchStatus;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when it was asked for",
  })
  requestedTime: Moment;

  @ApiTimestamp({
    required: false,
    description: "When it finished, done or failed",
  })
  finishedTime?: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description: "Why the batch failed as a whole",
  })
  error?: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How many messages it changes",
  })
  messages: number;

  @ApiProperty({
    type: () => MailChangeCounts,
    required: true,
    description: "Its changes by outcome",
  })
  counts: MailChangeCounts;
}

/** One message's change in a batch, with its labels before. */
export class MailChange {
  @ApiProperty({
    type: String,
    required: true,
    description: "The message's Gmail ID",
  })
  gmailId: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Its subject, while Minerva has the message",
  })
  subject?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Its sender, while Minerva has the message",
  })
  fromAddress?: string;

  @ApiProperty({
    enum: () => MailChangeStatus,
    enumName: "MailChangeStatus",
    enumSchema: { description: "What became of one message's change" },
    required: true,
    description: "What became of it",
  })
  status: MailChangeStatus;

  @ApiProperty({
    type: [String],
    required: true,
    description: "Its user labels when the batch was asked for",
  })
  had: string[];

  @ApiProperty({ type: [String], required: true, description: "Labels added" })
  add: string[];

  @ApiProperty({
    type: [String],
    required: true,
    description: "Labels removed",
  })
  remove: string[];
}

/** A proposal to mark processed without change. */
export class MailProposalRef {
  @ApiProperty({
    type: String,
    required: true,
    description: "The message's Gmail ID",
  })
  gmailId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The label proposed, by full name",
  })
  label: string;

  @ApiProperty({
    enum: () => MailAuditAction,
    enumName: "MailAuditAction",
    enumSchema: { description: "What a proposed label change does" },
    required: true,
    description: "Whether it was proposed to add or remove the label",
  })
  action: MailAuditAction;
}

/** One message's outcome, as the agent reports it. */
export class MailChangeOutcome {
  @ApiProperty({
    type: String,
    required: true,
    description: "The message's Gmail ID",
  })
  gmailId: string;

  @ApiProperty({
    enum: () => MailChangeStatus,
    enumName: "MailChangeStatus",
    enumSchema: { description: "What became of one message's change" },
    required: true,
    description: "What became of it (not pending)",
  })
  status: MailChangeStatus;
}

/** Which open proposals a bulk action takes, as the review filters them. */
export class MailProposalFilter {
  @ApiProperty({
    type: String,
    required: false,
    description: "Only changes to this label, by full name",
  })
  label?: string;

  @ApiProperty({
    enum: () => MailAuditAction,
    enumName: "MailAuditAction",
    enumSchema: { description: "What a proposed label change does" },
    required: false,
    description: "Only additions or only removals",
  })
  action?: MailAuditAction;

  @ApiProperty({
    enum: () => MailAuditRule,
    enumName: "MailAuditRule",
    enumSchema: {
      description: "What proposed a change: an audit rule, or the classifier",
    },
    required: false,
    description: "Only those one rule proposed",
  })
  rule?: MailAuditRule;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Only changes at least this confident, 0 to 1",
  })
  minConfidence?: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ApplyMatchingMailProposalsRequest {
  @ApiProperty({
    type: () => MailProposalFilter,
    required: true,
    description:
      "Which open proposals to apply; the classifier's unticked ones never are",
  })
  filter: MailProposalFilter;
}

export class DismissMatchingMailProposalsRequest {
  @ApiProperty({
    type: () => MailProposalFilter,
    required: true,
    description: "Which open proposals to mark processed",
  })
  filter: MailProposalFilter;
}

export class ApplyMailChangesRequest {
  @ApiProperty({
    type: () => MailLabelChange,
    isArray: true,
    required: true,
    description:
      "Each message's change, up to 10,000; labels must be the account's user labels with Gmail IDs",
  })
  changes: MailLabelChange[];
}

export class DismissMailProposalsRequest {
  @ApiProperty({
    type: () => MailProposalRef,
    isArray: true,
    required: true,
    description: "The proposals to mark processed, up to 10,000",
  })
  proposals: MailProposalRef[];
}

export class UpdateMailChangeBatchRequest {
  @ApiProperty({
    enum: () => MailChangeBatchReport,
    enumName: "MailChangeBatchReport",
    enumSchema: { description: "Where the agent has got to with a batch" },
    required: true,
    description: "Running, done (every change has its outcome), or failed",
  })
  status: MailChangeBatchReport;

  @ApiProperty({
    type: String,
    required: false,
    description: "Why it failed, for a failed batch; at most 500 characters",
  })
  error?: string;

  @ApiProperty({
    type: () => MailChangeOutcome,
    isArray: true,
    required: false,
    description: "Outcomes known since the last report",
  })
  changes?: MailChangeOutcome[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ApplyMatchingMailProposalsResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Open proposals the filter matched and applied",
  })
  proposals: number;

  @ApiProperty({
    type: () => MailChangeBatch,
    isArray: true,
    required: true,
    description:
      "The batches written for them: one per mailbox, or more for over 10,000 messages; none when nothing matched",
  })
  batches: MailChangeBatch[];
}

export class ApplyMailChangesResponse {
  @ApiProperty({
    type: () => MailChangeBatch,
    required: true,
    description: "The batch, as the agent took it",
  })
  batch: MailChangeBatch;
}

export class UndoMailChangeBatchResponse {
  @ApiProperty({
    type: () => MailChangeBatch,
    required: true,
    description: "The undo, a batch of its own",
  })
  batch: MailChangeBatch;
}

export class UpdateMailChangeBatchResponse {
  @ApiProperty({
    type: () => MailChangeBatch,
    required: true,
    description: "The batch, with the report recorded",
  })
  batch: MailChangeBatch;
}

export class ListMailChangeBatchesResponse {
  @ApiProperty({
    type: () => MailChangeBatch,
    isArray: true,
    required: true,
    description: "The account's batches, newest first",
  })
  batches: MailChangeBatch[];
}

export class DescribeMailChangeBatchResponse {
  @ApiProperty({
    type: () => MailChangeBatch,
    required: true,
    description: "The batch",
  })
  batch: MailChangeBatch;

  @ApiProperty({
    type: () => MailChange,
    isArray: true,
    required: true,
    description: "A page of its changes, by Gmail ID",
  })
  changes: MailChange[];
}

export class DismissMailProposalsResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Proposals marked processed",
  })
  dismissed: number;
}
