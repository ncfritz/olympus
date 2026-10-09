import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";
import { MailStarIcon } from "./sync";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** How a mail account came to be a user's (ADR 0030). */
export enum MailAccountVerification {
  /** Imported from a Takeout archive by an operator, for a named user. */
  Import = "import",
  /** The user signed in to it from Olympus (phase 1b). */
  Consent = "consent",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * One of a user's mailboxes (ADR 0030): its labels and message metadata are
 * kept in Minerva; its messages' bodies are not.
 */
export class MailAccount {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the account",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The mailbox's address, lower case",
  })
  email: string;

  @ApiProperty({
    enum: () => MailAccountVerification,
    enumName: "MailAccountVerification",
    enumSchema: {
      description: "How a mail account came to be a user's",
    },
    required: true,
    description: "How the account came to be the user's",
  })
  verification: MailAccountVerification;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the account became the user's",
  })
  verifiedTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "When the mailbox was linked to Gmail by its owner's sign-in; absent until it is (phase 1b)",
  })
  linkedTime?: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description: "The access Gmail granted, space-separated scopes",
  })
  linkScope?: string;

  @ApiTimestamp({
    required: false,
    description: "When the mailbox was last brought into step with Gmail",
  })
  syncedTime?: Moment;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "Gmail's own count of the mailbox's messages, at the last sync",
  })
  gmailMessagesTotal?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Gmail's count of its threads, at the last sync",
  })
  gmailThreadsTotal?: number;

  @ApiProperty({
    enum: () => MailStarIcon,
    enumName: "MailStarIcon",
    enumSchema: { description: "Gmail's star icons, by search name" },
    required: false,
    description:
      "The star that marks a message wanting attention (an open state)",
  })
  attentionStar?: MailStarIcon;

  @ApiProperty({
    enum: () => MailStarIcon,
    enumName: "MailStarIcon",
    enumSchema: { description: "Gmail's star icons, by search name" },
    required: false,
    description: "The star that marks a message done (a closed state)",
  })
  doneStar?: MailStarIcon;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ImportMailAccountRequest {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The address of the mailbox the Takeout archive was exported from.",
  })
  email: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The email of the Olympus user the mailbox belongs to.",
  })
  ownerEmail: string;
}

export class ConnectMailAccountRequest {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The site page to come back to when the sign-in is done, with the outcome in its query (mailAccount=connected, cancelled, expired, refused or failed). It must be a page of one of the API's clients.",
  })
  returnTo: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ImportMailAccountResponse {
  @ApiProperty({
    type: () => MailAccount,
    required: true,
    description: "The account the archive's messages are imported into.",
  })
  mailAccount: MailAccount;
}

export class ListMailAccountsResponse {
  @ApiProperty({
    type: () => MailAccount,
    isArray: true,
    required: true,
    description: "The caller's mail accounts, by address",
  })
  accounts: MailAccount[];
}

export class ConnectMailAccountResponse {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "Google's sign-in page, for the browser to go to. The sign-in expires in ten minutes.",
  })
  authUrl: string;
}
