import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** How far back mail statistics look (docs/plans/email-management phase 2). */
export enum MailStatisticsRange {
  /** The last twelve months. */
  TwelveMonths = "12m",
  /** The last three years. */
  ThreeYears = "3y",
  /** Everything stored. */
  AllTime = "all",
}

/** Which messages mail statistics count. */
export enum MailStatisticsScope {
  /** Received and sent. */
  All = "all",
  /** Mail received: everything not sent from the mailbox. */
  Received = "received",
  /** Mail sent from the mailbox. */
  Sent = "sent",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The Statistics page's strip: totals over the range and scope. */
export class MailStatisticsSummary {
  @ApiProperty({ type: Number, required: true, description: "Messages" })
  messages: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "User labels on at least one of the messages",
  })
  labelsInUse: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Distinct sender addresses",
  })
  senders: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages with no user label (categories do not count)",
  })
  unlabelled: number;

  @ApiTimestamp({
    required: false,
    description: "When the earliest message was received; absent when none",
  })
  firstReceivedTime?: Moment;

  @ApiTimestamp({
    required: false,
    description: "When the latest message was received; absent when none",
  })
  lastReceivedTime?: Moment;
}

/** A sender and how much mail it sent in the range and scope. */
export class MailSenderStatistics {
  @ApiProperty({
    type: String,
    required: true,
    description: "The sender's address, lower case",
  })
  address: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "A display name the sender used, when it gave one",
  })
  name?: string;

  @ApiProperty({ type: Number, required: true, description: "Messages" })
  messages: number;

  @ApiTimestamp({
    required: true,
    description: "When its latest message was received",
  })
  lastReceivedTime: Moment;
}

/** A user label and how much mail carries it in the range and scope. */
export class MailLabelStatistics {
  @ApiProperty({
    type: String,
    required: true,
    description: "The label's full name, as Gmail shows it",
  })
  name: string;

  @ApiProperty({ type: Number, required: true, description: "Messages" })
  messages: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Distinct senders of those messages",
  })
  senders: number;

  @ApiTimestamp({
    required: true,
    description: "When its latest message was received",
  })
  lastReceivedTime: Moment;
}

/** One top sender's messages in one year (UTC). */
export class MailSenderYear {
  @ApiProperty({ type: String, required: true, description: "The sender" })
  address: string;

  @ApiProperty({ type: Number, required: true, description: "The year" })
  year: number;

  @ApiProperty({ type: Number, required: true, description: "Messages" })
  messages: number;
}

/** One top label's messages in one year (UTC). */
export class MailLabelYear {
  @ApiProperty({ type: String, required: true, description: "The label" })
  name: string;

  @ApiProperty({ type: Number, required: true, description: "The year" })
  year: number;

  @ApiProperty({ type: Number, required: true, description: "Messages" })
  messages: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class GetMailStatisticsResponse {
  @ApiProperty({
    enum: () => MailStatisticsRange,
    enumName: "MailStatisticsRange",
    enumSchema: { description: "How far back mail statistics look" },
    required: true,
    description: "The range counted",
  })
  range: MailStatisticsRange;

  @ApiProperty({
    enum: () => MailStatisticsScope,
    enumName: "MailStatisticsScope",
    enumSchema: { description: "Which messages mail statistics count" },
    required: true,
    description: "The scope counted",
  })
  scope: MailStatisticsScope;

  @ApiTimestamp({
    required: false,
    description: "The start of the range; absent for all time",
  })
  sinceTime?: Moment;

  @ApiProperty({
    type: () => MailStatisticsSummary,
    required: true,
    description: "Totals over the range and scope",
  })
  summary: MailStatisticsSummary;

  @ApiProperty({
    type: () => MailSenderStatistics,
    isArray: true,
    required: true,
    description: "The busiest senders, busiest first",
  })
  topSenders: MailSenderStatistics[];

  @ApiProperty({
    type: () => MailLabelStatistics,
    isArray: true,
    required: true,
    description: "The busiest user labels, busiest first",
  })
  topLabels: MailLabelStatistics[];

  @ApiProperty({
    type: () => MailSenderYear,
    isArray: true,
    required: true,
    description:
      "Messages per year from the busiest few senders, by sender then year; a year without mail is absent",
  })
  senderActivity: MailSenderYear[];

  @ApiProperty({
    type: () => MailLabelYear,
    isArray: true,
    required: true,
    description:
      "Messages per year under the busiest labels, by label then year; a year without mail is absent",
  })
  labelActivity: MailLabelYear[];
}
