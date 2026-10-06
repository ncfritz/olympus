import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A mail account the classifier trains for. */
export class MailTrainingAccount {
  @ApiProperty({
    type: String,
    required: true,
    description: "The account's ID",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The mailbox's address",
  })
  email: string;
}

/**
 * One message as the classifier learns from it: metadata and its labels as
 * training targets (ADR 0030, Label kinds). A topical label is a topic; a
 * state counts as its family; a retired label counts as what it merges
 * into; system labels and stars are never targets.
 */
export class MailTrainingExample {
  @ApiProperty({
    type: String,
    required: true,
    description: "The message's Gmail ID, hexadecimal",
  })
  gmailId: string;

  @ApiProperty({ type: String, required: true, description: "Its thread" })
  threadId: string;

  @ApiTimestamp({ required: true, description: "When it was received" })
  receivedTime: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description: "The sender's address",
  })
  fromAddress?: string;

  @ApiProperty({ type: String, required: false, description: "Its List-Id" })
  listId?: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether it was sent from the mailbox",
  })
  sent: boolean;

  @ApiProperty({
    type: [String],
    required: true,
    description: "Its topical labels, by full name, sorted",
  })
  topics: string[];

  @ApiProperty({
    type: [String],
    required: true,
    description: "The families of its state labels, by name, sorted",
  })
  families: string[];
}

/** A state family as the classifier sees it. */
export class MailTrainingFamily {
  @ApiProperty({ type: String, required: true, description: "Its name" })
  name: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The label a message predicted in it is given",
  })
  initialLabel: string;

  @ApiProperty({
    type: [String],
    required: true,
    description: "All its states' labels, by name",
  })
  states: string[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListMailTrainingAccountsResponse {
  @ApiProperty({
    type: () => MailTrainingAccount,
    isArray: true,
    required: true,
    description: "Every mail account",
  })
  accounts: MailTrainingAccount[];
}

export class ListMailTrainingExamplesResponse {
  @ApiProperty({
    type: () => MailTrainingExample,
    isArray: true,
    required: true,
    description: "A page of examples, by Gmail ID",
  })
  examples: MailTrainingExample[];

  @ApiProperty({
    type: String,
    required: false,
    description: "Pass as `after` for the next page; absent on the last",
  })
  nextCursor?: string;
}

export class ListMailTrainingLabelsResponse {
  @ApiProperty({
    type: [String],
    required: true,
    description: "The account's topical labels, by name: what can be suggested",
  })
  topics: string[];

  @ApiProperty({
    type: () => MailTrainingFamily,
    isArray: true,
    required: true,
    description: "Its state families, by name",
  })
  families: MailTrainingFamily[];
}
