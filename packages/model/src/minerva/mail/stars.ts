import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";
import { MailStarIcon } from "./sync";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** How a message's star is put back in step with its state. */
export enum MailStarFix {
  /** An open state, not starred: star it (Gmail sets its first star). */
  Star = "star",
  /** An open state, starred with another icon: set the attention star. */
  AttentionIcon = "attention-icon",
  /** A closed state still carrying the attention star: set the done star. */
  DoneIcon = "done-icon",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A message whose state and star disagree (phase 7, M12 case 3). */
export class MailStarMismatch {
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
    description: "Its state label, by full name",
  })
  label: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the state is open (wants attention)",
  })
  stateOpen: boolean;

  @ApiProperty({ type: Boolean, required: true, description: "Starred now" })
  starred: boolean;

  @ApiProperty({
    enum: () => MailStarIcon,
    enumName: "MailStarIcon",
    enumSchema: { description: "Gmail's star icons, by search name" },
    required: false,
    description: "Its star icon now, when sync found one",
  })
  starIcon?: MailStarIcon;

  @ApiProperty({
    enum: () => MailStarFix,
    enumName: "MailStarFix",
    enumSchema: {
      description: "How a message's star is put back in step with its state",
    },
    required: true,
    description: "The fix",
  })
  fix: MailStarFix;

  @ApiProperty({
    enum: () => MailStarIcon,
    enumName: "MailStarIcon",
    enumSchema: { description: "Gmail's star icons, by search name" },
    required: true,
    description:
      "The star its state wants: the account's attention or done star",
  })
  wanted: MailStarIcon;
}

/** How many mismatches want each fix. */
export class MailStarMismatchCounts {
  @ApiProperty({ type: Number, required: true, description: "To star" })
  star: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "To give the attention star",
  })
  attentionIcon: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "To give the done star",
  })
  doneIcon: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListMailStarMismatchesResponse {
  @ApiProperty({
    type: () => MailStarMismatch,
    isArray: true,
    required: true,
    description: "A page of them, newest first",
  })
  mismatches: MailStarMismatch[];

  @ApiProperty({
    type: Number,
    required: true,
    description: "How many match the filters",
  })
  count: number;

  @ApiProperty({
    type: () => MailStarMismatchCounts,
    required: true,
    description:
      "How many of the caller's want each fix, across the filters but the fix",
  })
  counts: MailStarMismatchCounts;
}
