import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";
import { MailStarIcon } from "./sync";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * A payment confirmation and the open bill it pays (phase 7 step 2): the
 * bill moves along its family's transition, `Bills/*Payable` to
 * `Bills/*Paid`.
 */
export class MailPaymentMatch {
  @ApiProperty({ type: String, required: true, description: "The account" })
  accountId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The confirmation's Gmail ID",
  })
  confirmationGmailId: string;

  @ApiTimestamp({
    required: true,
    description: "When the confirmation was received",
  })
  confirmedTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description: "The bill's Gmail ID",
  })
  billGmailId: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The bill's subject",
  })
  billSubject?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The bill's sender",
  })
  billFromAddress?: string;

  @ApiTimestamp({ required: true, description: "When the bill was received" })
  billReceivedTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description: "The bill's open state now, by full name",
  })
  fromLabel: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The closed state it moves to, by full name",
  })
  toLabel: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the bill is starred (its star to change to done)",
  })
  billStarred: boolean;
}

/** A message in an open state: an open bill. */
export class MailOpenBill {
  @ApiProperty({ type: String, required: true, description: "The account" })
  accountId: string;

  @ApiProperty({ type: String, required: true, description: "Its Gmail ID" })
  gmailId: string;

  @ApiProperty({ type: String, required: false, description: "The sender" })
  fromAddress?: string;

  @ApiProperty({ type: String, required: false, description: "The subject" })
  subject?: string;

  @ApiTimestamp({ required: true, description: "When it was received" })
  receivedTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its open state, by full name",
  })
  label: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The closed state its transition leads to; absent when the family has none from it",
  })
  toLabel?: string;

  @ApiProperty({ type: Boolean, required: true, description: "Starred now" })
  starred: boolean;

  @ApiProperty({
    enum: () => MailStarIcon,
    enumName: "MailStarIcon",
    enumSchema: { description: "Gmail's star icons, by search name" },
    required: false,
    description: "Its star icon, when sync found one",
  })
  starIcon?: MailStarIcon;
}

/** Open bills by how long they have been open. */
export class MailOpenBillAges {
  @ApiProperty({ type: Number, required: true, description: "Under 30 days" })
  month: number;

  @ApiProperty({ type: Number, required: true, description: "30 to 90 days" })
  quarter: number;

  @ApiProperty({ type: Number, required: true, description: "Over 90 days" })
  older: number;
}

/** A confirmation and a bill, by Gmail ID. */
export class MailPaymentPair {
  @ApiProperty({
    type: String,
    required: true,
    description: "The confirmation's Gmail ID",
  })
  confirmationGmailId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The bill's Gmail ID",
  })
  billGmailId: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class DismissMailPaymentMatchesRequest {
  @ApiProperty({
    type: () => MailPaymentPair,
    isArray: true,
    required: true,
    description: "Up to 1,000 pairs that are not a bill and its payment",
  })
  pairs: MailPaymentPair[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListMailPaymentMatchesResponse {
  @ApiProperty({
    type: () => MailPaymentMatch,
    isArray: true,
    required: true,
    description: "A page of matches, newest confirmation first",
  })
  matches: MailPaymentMatch[];

  @ApiProperty({
    type: Number,
    required: true,
    description: "How many match the filters",
  })
  count: number;
}

export class ListMailOpenBillsResponse {
  @ApiProperty({
    type: () => MailOpenBill,
    isArray: true,
    required: true,
    description: "A page of open bills, oldest first",
  })
  bills: MailOpenBill[];

  @ApiProperty({ type: Number, required: true, description: "All of them" })
  count: number;

  @ApiProperty({
    type: () => MailOpenBillAges,
    required: true,
    description: "How long they have been open",
  })
  ages: MailOpenBillAges;
}

export class DismissMailPaymentMatchesResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Pairs recorded as declined",
  })
  dismissed: number;
}
