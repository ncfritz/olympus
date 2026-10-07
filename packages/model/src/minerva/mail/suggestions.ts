import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";
import { MailAuditAction } from "./audit";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Where a run of the classifier's suggestions is. */
export enum MailSuggestionRunStatus {
  /** The classifier is still posting to it; it proposes nothing yet. */
  Building = "building",
  /** Published: its suggestions are the account's, replacing the run before. */
  Ready = "ready",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * One pass of the classifier's suggestions over an account's mail
 * (docs/plans/email-management phase 4): every message scored by a model
 * that never saw it, and a suggestion wherever it confidently disagrees.
 */
export class MailSuggestionRun {
  @ApiProperty({ type: String, required: true, description: "The run's ID" })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The mail account",
  })
  accountId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The classifier's model run the scores came from",
  })
  modelRun: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The feature version the scores came from",
  })
  featureVersion: string;

  @ApiProperty({
    enum: () => MailSuggestionRunStatus,
    enumName: "MailSuggestionRunStatus",
    enumSchema: {
      description: "Where a run of the classifier's suggestions is",
    },
    required: true,
    description: "Building, or published",
  })
  status: MailSuggestionRunStatus;

  @ApiTimestamp({ required: true, description: "When the run began" })
  startedTime: Moment;

  @ApiTimestamp({ required: false, description: "When it was published" })
  finishedTime?: Moment;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Messages scored, once published",
  })
  messagesScored?: number;
}

/** A suggestion as the classifier posts it: a message and label by name. */
export class NewMailSuggestion {
  @ApiProperty({
    type: String,
    required: true,
    description: "The message's Gmail ID",
  })
  gmailId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The label's full name",
  })
  label: string;

  @ApiProperty({
    enum: () => MailAuditAction,
    enumName: "MailAuditAction",
    enumSchema: { description: "What a proposed label change does" },
    required: true,
    description: "Add the label, or remove it",
  })
  action: MailAuditAction;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How sure the classifier is, 0 to 1",
  })
  confidence: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether it is at or above the label's threshold",
  })
  ticked: boolean;
}

/** A label suggested for new mail, as the mail agent posts it. */
export class NewMailMessageSuggestion {
  @ApiProperty({
    type: String,
    required: true,
    description: "The label's full name",
  })
  label: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The serving model's calibrated score, 0 to 1",
  })
  score: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether it is at or above the label's threshold",
  })
  ticked: boolean;
}

/** A message scored as it arrived, with its suggestions best first. */
export class ScoredMailMessage {
  @ApiProperty({
    type: String,
    required: true,
    description: "The message's Gmail ID",
  })
  gmailId: string;

  @ApiProperty({
    type: () => NewMailMessageSuggestion,
    isArray: true,
    required: true,
    description:
      "Up to 20 labels, best first; none when nothing scored high enough",
  })
  suggestions: NewMailMessageSuggestion[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateMailSuggestionRunRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "The mail account",
  })
  accountId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The classifier's model run",
  })
  modelRun: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The feature version",
  })
  featureVersion: string;
}

export class CreateMailSuggestionsRequest {
  @ApiProperty({
    type: () => NewMailSuggestion,
    isArray: true,
    required: true,
    description: "Up to 5,000 suggestions",
  })
  suggestions: NewMailSuggestion[];
}

export class PublishMailSuggestionRunRequest {
  @ApiProperty({
    type: Number,
    required: true,
    description: "How many messages the classifier scored",
  })
  messagesScored: number;
}

export class RecordMailMessageSuggestionsRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "The classifier's model run that scored them",
  })
  modelRun: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The feature version",
  })
  featureVersion: string;

  @ApiProperty({
    type: () => ScoredMailMessage,
    isArray: true,
    required: true,
    description: "Up to 500 messages",
  })
  messages: ScoredMailMessage[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateMailSuggestionRunResponse {
  @ApiProperty({
    type: () => MailSuggestionRun,
    required: true,
    description: "The run, building",
  })
  run: MailSuggestionRun;
}

export class PublishMailSuggestionRunResponse {
  @ApiProperty({
    type: () => MailSuggestionRun,
    required: true,
    description: "The run, published",
  })
  run: MailSuggestionRun;
}

export class CreateMailSuggestionsResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Suggestions stored (or replaced)",
  })
  created: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Suggestions left out: an unknown message or label, a label that is not the user's, adding a label the message has, or removing one it lacks",
  })
  skipped: number;
}

export class RecordMailMessageSuggestionsResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages whose suggestions were stored (or replaced)",
  })
  messages: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Suggestions stored",
  })
  suggestions: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Suggestions left out: a label the mailbox does not have, or not the user's own",
  })
  skipped: number;
}
