import { ApiProperty } from "@nestjs/swagger";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** What a label is to the classifier (ADR 0030, Label kinds). */
export enum MailLabelKind {
  /** Predicted by the classifier: most labels. */
  Topical = "topical",
  /** One of a family's states; the classifier predicts the family. */
  State = "state",
  /** Gmail's own (categories): read and written as flags, never trained on. */
  System = "system",
  /** Being merged; picking it applies its merge target. */
  Retired = "retired",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A label of one of the caller's mailboxes, with its kind. */
export class MailLabel {
  @ApiProperty({ type: String, required: true, description: "The label's ID" })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The mail account it belongs to",
  })
  accountId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its full name, as Gmail shows it (`Bills/*Paid`)",
  })
  name: string;

  @ApiProperty({
    enum: () => MailLabelKind,
    enumName: "MailLabelKind",
    enumSchema: { description: "What a label is to the classifier" },
    required: true,
    description: "Its kind",
  })
  kind: MailLabelKind;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages with the label",
  })
  messages: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "For a state, the family it belongs to",
  })
  familyId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "For a state, its family's name",
  })
  familyName?: string;

  @ApiProperty({
    type: Boolean,
    required: false,
    description:
      "For a state: open (the message wants attention) or closed (its action is done)",
  })
  stateOpen?: boolean;

  @ApiProperty({
    type: String,
    required: false,
    description: "For a retired label, the label it is merged into",
  })
  mergeTargetId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "For a retired label, its merge target's name",
  })
  mergeTargetName?: string;
}

/** One of a family's states. */
export class MailLabelFamilyState {
  @ApiProperty({ type: String, required: true, description: "The label" })
  labelId: string;

  @ApiProperty({ type: String, required: true, description: "Its name" })
  name: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Open (the message wants attention) or closed (its action is done)",
  })
  open: boolean;
}

/** A move a family allows, from one of its states to another. */
export class MailLabelTransition {
  @ApiProperty({ type: String, required: true, description: "From this state" })
  fromLabelId: string;

  @ApiProperty({ type: String, required: true, description: "To this state" })
  toLabelId: string;
}

/**
 * A family of state labels (`Bills`: `*Payable`, then `*Paid`): the
 * classifier predicts the family and the initial state is applied.
 */
export class MailLabelFamily {
  @ApiProperty({ type: String, required: true, description: "The family's ID" })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The mail account it belongs to",
  })
  accountId: string;

  @ApiProperty({ type: String, required: true, description: "Its name" })
  name: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The state a message enters the family in",
  })
  initialLabelId: string;

  @ApiProperty({
    type: () => MailLabelFamilyState,
    isArray: true,
    required: true,
    description: "Its states, by name",
  })
  states: MailLabelFamilyState[];

  @ApiProperty({
    type: () => MailLabelTransition,
    isArray: true,
    required: true,
    description: "The moves it allows between them",
  })
  transitions: MailLabelTransition[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class UpdateMailLabelRequest {
  @ApiProperty({
    enum: () => MailLabelKind,
    enumName: "MailLabelKind",
    enumSchema: { description: "What a label is to the classifier" },
    required: true,
    description:
      "`topical` or `retired`; a label becomes a state by joining a family",
  })
  kind: MailLabelKind;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "For `retired`: the label it merges into, in the same account, not itself retired",
  })
  mergeTargetId?: string;
}

export class CreateMailLabelFamilyState {
  @ApiProperty({ type: String, required: true, description: "The label" })
  labelId: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Open (wants attention) or closed (done)",
  })
  open: boolean;
}

export class CreateMailLabelFamilyRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "The family's name, unique in its account (`Bills`)",
  })
  name: string;

  @ApiProperty({
    type: () => CreateMailLabelFamilyState,
    isArray: true,
    required: true,
    description:
      "Its states: two or more topical labels of one account, each open or closed",
  })
  states: CreateMailLabelFamilyState[];

  @ApiProperty({
    type: String,
    required: true,
    description: "The open state a message enters the family in",
  })
  initialLabelId: string;

  @ApiProperty({
    type: () => MailLabelTransition,
    isArray: true,
    required: true,
    description: "The moves allowed between the states",
  })
  transitions: MailLabelTransition[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListMailLabelsResponse {
  @ApiProperty({
    type: () => MailLabel,
    isArray: true,
    required: true,
    description: "The caller's labels, by name",
  })
  labels: MailLabel[];
}

export class UpdateMailLabelResponse {
  @ApiProperty({
    type: () => MailLabel,
    required: true,
    description: "The label as it now is",
  })
  label: MailLabel;
}

export class ListMailLabelFamiliesResponse {
  @ApiProperty({
    type: () => MailLabelFamily,
    isArray: true,
    required: true,
    description: "The caller's label families, by name",
  })
  families: MailLabelFamily[];
}

export class CreateMailLabelFamilyResponse {
  @ApiProperty({
    type: () => MailLabelFamily,
    required: true,
    description: "The new family",
  })
  family: MailLabelFamily;
}
