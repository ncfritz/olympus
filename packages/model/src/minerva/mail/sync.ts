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

/**
 * Gmail's star icons (Settings, Stars), by the name its search uses
 * (`has:red-bang`); the same as @ncfritz/olympus-messages' MAIL_STAR_ICONS.
 */
export enum MailStarIcon {
  YellowStar = "yellow-star",
  OrangeStar = "orange-star",
  RedStar = "red-star",
  PurpleStar = "purple-star",
  BlueStar = "blue-star",
  GreenStar = "green-star",
  RedBang = "red-bang",
  OrangeGuillemet = "orange-guillemet",
  YellowBang = "yellow-bang",
  GreenCheck = "green-check",
  BlueInfo = "blue-info",
  PurpleQuestion = "purple-question",
}

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

/** A mailbox linked to Gmail, and where its history polling carries on. */
export class MailSyncAccount {
  @ApiProperty({
    type: String,
    required: true,
    description: "The account's ID",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The mailbox's address, lower case",
  })
  email: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "Gmail's historyId to poll from; absent until the first reconcile",
  })
  historyId?: string;
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

  @ApiProperty({
    enum: () => MailStarIcon,
    enumName: "MailStarIcon",
    enumSchema: { description: "Gmail's star icons, by search name" },
    required: false,
    description:
      "A starred message's star icon, by Gmail's search name; absent when not starred or none was found",
  })
  starIcon?: MailStarIcon;
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

export class ListMailSyncAccountsResponse {
  @ApiProperty({
    type: () => MailSyncAccount,
    isArray: true,
    required: true,
    description: "Every mail account linked to Gmail, by address",
  })
  accounts: MailSyncAccount[];
}

export class UpdateMailAccountSyncResponse {
  @ApiProperty({
    type: () => MailAccount,
    required: true,
    description: "The account, with its sync recorded",
  })
  mailAccount: MailAccount;
}
