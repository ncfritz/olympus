import { ApiProperty } from "@nestjs/swagger";
import { MailAccount } from "./accounts";

/*
 * Keeping a linked mailbox in step with Gmail (docs/plans/email-management
 * phase 1b): what the mail agent reads of Minerva's mailbox to compare with
 * Gmail's, and what it records once they agree. For agents only.
 */

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Gmail's system labels that Minerva keeps as flags on a message. */
export class MailMessageStateFlags {
  @ApiProperty({ type: Boolean, required: true, description: "In the inbox" })
  inbox: boolean;

  @ApiProperty({ type: Boolean, required: true, description: "Unread" })
  unread: boolean;

  @ApiProperty({ type: Boolean, required: true, description: "Starred" })
  starred: boolean;

  @ApiProperty({ type: Boolean, required: true, description: "Important" })
  important: boolean;

  @ApiProperty({ type: Boolean, required: true, description: "Sent" })
  sent: boolean;
}

/** A message's labels and flags as Minerva has them. */
export class MailMessageState {
  @ApiProperty({
    type: String,
    required: true,
    description: "The message's Gmail ID, hexadecimal",
  })
  gmailId: string;

  @ApiProperty({
    type: [String],
    required: true,
    description: "Its user labels by full name, sorted",
  })
  labels: string[];

  @ApiProperty({
    type: [String],
    required: true,
    description: "Its Gmail categories, lower case, sorted",
  })
  categories: string[];

  @ApiProperty({
    type: () => MailMessageStateFlags,
    required: true,
    description: "Its flags",
  })
  flags: MailMessageStateFlags;
}

/** One of the mailbox's labels as Gmail's labels.list has it. */
export class GmailLabel {
  @ApiProperty({
    type: String,
    required: true,
    description: "Gmail's label ID (`Label_12`, `CATEGORY_UPDATES`)",
  })
  gmailLabelId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its full name, as Gmail shows it",
  })
  name: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "user, or system",
  })
  type: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class SyncMailLabelsRequest {
  @ApiProperty({
    type: () => GmailLabel,
    isArray: true,
    required: true,
    description: "Every label Gmail has for the mailbox",
  })
  labels: GmailLabel[];
}

export class UpdateMailAccountSyncRequest {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "Gmail's historyId when the reconcile began, where history polling carries on from",
  })
  historyId: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Gmail's count of the mailbox's messages (getProfile)",
  })
  messagesTotal: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Gmail's count of its threads (getProfile)",
  })
  threadsTotal: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListMailMessageStatesResponse {
  @ApiProperty({
    type: () => MailMessageState,
    isArray: true,
    required: true,
    description: "A page of the account's messages, by Gmail ID",
  })
  messages: MailMessageState[];

  @ApiProperty({
    type: String,
    required: false,
    description: "Pass as `after` for the next page; absent on the last",
  })
  nextCursor?: string;
}

export class SyncMailLabelsResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Labels given their Gmail ID",
  })
  matched: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "User labels made in Gmail since the import, added",
  })
  created: number;

  @ApiProperty({
    type: [String],
    required: true,
    description:
      "Minerva's user labels Gmail no longer has, by name: kept, with their kinds, until their messages say otherwise",
  })
  notInGmail: string[];
}

export class UpdateMailAccountSyncResponse {
  @ApiProperty({
    type: () => MailAccount,
    required: true,
    description: "The account, with its sync recorded",
  })
  mailAccount: MailAccount;
}
