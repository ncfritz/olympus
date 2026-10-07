import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * A sender whose approved inbox mail nearly always carries one label
 * (phase 7 step 4): a Gmail filter could apply it as the mail arrives.
 */
export class MailFilterProposal {
  @ApiProperty({ type: String, required: true, description: "The account" })
  accountId: string;

  @ApiProperty({ type: String, required: true, description: "The sender" })
  fromAddress: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The label, by full name",
  })
  label: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The sender's messages approved in the inbox",
  })
  decisions: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Of them, those carrying the label now",
  })
  kept: number;

  @ApiTimestamp({ required: true, description: "The latest approval" })
  lastDecidedTime: Moment;
}

/** A Gmail filter made from a proposal. */
export class MailFilter {
  @ApiProperty({ type: String, required: true, description: "Its ID" })
  id: string;

  @ApiProperty({ type: String, required: true, description: "The account" })
  accountId: string;

  @ApiProperty({ type: String, required: true, description: "The sender" })
  fromAddress: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The label it applies, by full name",
  })
  label: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether its mail skips the inbox",
  })
  skipInbox: boolean;

  @ApiTimestamp({ required: true, description: "When it was made" })
  createdTime: Moment;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateMailFilterRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "The sender, an address",
  })
  fromAddress: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The user label to apply, by full name",
  })
  label: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the sender's mail skips the inbox",
  })
  skipInbox: boolean;
}

export class DismissMailFilterProposalRequest {
  @ApiProperty({ type: String, required: true, description: "The sender" })
  fromAddress: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The label, by full name",
  })
  label: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListMailFilterProposalsResponse {
  @ApiProperty({
    type: () => MailFilterProposal,
    isArray: true,
    required: true,
    description: "The proposals, most approvals first",
  })
  proposals: MailFilterProposal[];
}

export class ListMailFiltersResponse {
  @ApiProperty({
    type: () => MailFilter,
    isArray: true,
    required: true,
    description: "The filters made, newest first",
  })
  filters: MailFilter[];
}

export class CreateMailFilterResponse {
  @ApiProperty({
    type: () => MailFilter,
    required: true,
    description: "The filter, made in Gmail",
  })
  filter: MailFilter;
}

export class DismissMailFilterProposalResponse {
  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the proposal was recorded as declined",
  })
  dismissed: boolean;
}
