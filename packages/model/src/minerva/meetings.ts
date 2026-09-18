import { ApiTimestamp } from "../decorators";
import {
  ApiExtraModels,
  ApiProperty,
  getSchemaPath,
  PartialType,
} from "@nestjs/swagger";
import type { Moment } from "moment";

export enum MeetingSensitivity {
  Normal = "Normal",
  Personal = "Personal",
  Private = "Private",
  Confidential = "Confidential",
}

export enum MeetingImportance {
  Low = "Low",
  Normal = "Normal",
  High = "High",
}

export enum MeetingOccurrenceType {
  Single = "Single",
  Occurrence = "Occurrence",
  Exception = "Exception",
  RecurringMaster = "RecurringMaster",
}

export enum MeetingStatus {
  Free = "Free",
  Tentative = "Tentative",
  Busy = "Busy",
  OOF = "OOF",
  WorkingElsewhere = "WorkingElsewhere",
  NoData = "NoData",
}

export enum MeetingSource {
  AMZN = "amzn",
  UNKNOWN = "unknown",
}

export class Meeting {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the meeting",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "A secondary identifier from the calendar provider",
  })
  uid?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "A secondary identifier from the calendar provider denoting which recurrence of the parent meeting this is",
  })
  recurrenceId?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The meeting subject",
  })
  subject: string;

  @ApiProperty({
    enum: () => MeetingSensitivity,
    enumName: "MeetingSensitivity",
    required: true,
    description:
      "The sensitivity level of the meeting, i.e. personal, private, etc.",
  })
  sensitivity: MeetingSensitivity;

  @ApiProperty({
    enum: () => MeetingImportance,
    enumName: "MeetingImportance",
    required: true,
    description: "The importance level of the meeting, i.e. low, high, etc.",
  })
  importance: MeetingImportance;

  @ApiProperty({
    enum: () => MeetingOccurrenceType,
    enumName: "MeetingOccurrenceType",
    required: true,
    description:
      "The type of occurrence of the meeting, i.e. exception, regular, etc.",
  })
  occurrenceType: MeetingOccurrenceType;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The type of meeting, i.e. whether the meeting is a standard meeting, appointment, etc.",
  })
  type: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Indicates if a reminder has been set for the meeting",
  })
  reminder: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "Indicates if the meeting has been accepted, or if the user is the meeting organizer",
  })
  response: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the meeting starts",
  })
  startTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the meeting ends",
  })
  endTime?: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The duration of the meeting in minutes",
  })
  duration: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "`true` if the meeting is an all-day event, `false` otherwise",
  })
  isAllDay: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "`true` if the meeting has been marked as deleted, `false` otherwise",
  })
  isDeleted: boolean;

  @ApiProperty({
    enum: () => MeetingSource,
    enumName: "MeetingSource",
    required: true,
    description: "Indicates where the meeting information was gathered from",
  })
  source: MeetingSource;

  @ApiProperty({
    enum: () => MeetingStatus,
    enumName: "MeetingStatus",
    required: true,
    description:
      "The status of the meeting, this is an indication of free/busy",
  })
  status: MeetingStatus;

  @ApiProperty({
    type: String,
    required: false,
    description: "Where the meeting will take place",
  })
  location?: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "`true` if the meeting has been canceled, `false` otherwise",
  })
  isCancelled: boolean;

  @ApiProperty({
    type: () => MeetingUser,
    required: true,
    description: "Indicates who organized the meeting",
  })
  organizer: MeetingUser;

  @ApiProperty({
    type: () => MeetingAttendee,
    isArray: true,
    required: true,
    description: "A list of users who have been invited to the meeting",
  })
  attendees: MeetingAttendee[];
}

export class PartialMeeting extends PartialType(Meeting) {}

export class MeetingUser {
  @ApiProperty({
    type: String,
    required: true,
    description: "The email address of the user",
  })
  email: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Optional user ID of the user",
  })
  alias?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The user's first name",
  })
  givenName: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The user's last name",
  })
  surname?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The role the user is acting in for the meeting",
  })
  type: string;
}

class MeetingTimeStatistic {
  @ApiProperty({
    type: Number,
    required: true,
    description: "The total amount of time meetings occupy for a time period",
  })
  totalDurationMin: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of meeting occurring in a time period",
  })
  count: number;
}

export class MeetingStatusStatistics {
  @ApiProperty({
    type: () => MeetingTimeStatistic,
    required: true,
    description: "The statistics for meeting marked as free",
  })
  [MeetingStatus.Free]: MeetingTimeStatistic;

  @ApiProperty({
    type: () => MeetingTimeStatistic,
    required: true,
    description: "The statistics for meeting marked as busy",
  })
  [MeetingStatus.Busy]: MeetingTimeStatistic;

  @ApiProperty({
    type: () => MeetingTimeStatistic,
    required: true,
    description: "The statistics for meeting marked as tentative",
  })
  [MeetingStatus.Tentative]: MeetingTimeStatistic;

  @ApiProperty({
    type: () => MeetingTimeStatistic,
    required: true,
    description: "The statistics for meeting marked as out-of-office",
  })
  [MeetingStatus.OOF]: MeetingTimeStatistic;

  @ApiProperty({
    type: () => MeetingTimeStatistic,
    required: true,
    description: "The statistics for meeting marked as no-data",
  })
  [MeetingStatus.NoData]: MeetingTimeStatistic;

  @ApiProperty({
    type: () => MeetingTimeStatistic,
    required: true,
    description: "The statistics for meeting marked as working elsewhere",
  })
  [MeetingStatus.WorkingElsewhere]: MeetingTimeStatistic;
}

export class MeetingAttendee extends MeetingUser {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "Indicates a user's requested attendance for the meeting, i.e. optional, required, etc.",
  })
  attendance: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The user's acceptance response for the meeting",
  })
  response: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateCalendarItemRequest {
  @ApiProperty({
    type: () => Meeting,
    required: true,
    description: "The meeting to be created",
  })
  item: Meeting;
}

export class UpdateCalendarItemRequest {
  @ApiProperty({
    type: () => PartialMeeting,
    required: true,
    description: "A partial meeting representing the changes to be made",
  })
  item: PartialMeeting;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class SingleCalendarItemResponse {
  @ApiProperty({
    type: () => Meeting,
    required: false,
    description: "The created, updated, or requested meeting",
  })
  item?: Meeting;
}

export class ListCalendarItemsResponse {
  @ApiProperty({
    type: () => Meeting,
    isArray: true,
    required: true,
    description: "A list of meetings for the requested time period",
  })
  items: Meeting[];
}

@ApiExtraModels(MeetingStatusStatistics)
export class GetMeetingStatisticsResponse {
  @ApiProperty({
    type: Object,
    additionalProperties: { $ref: getSchemaPath(MeetingStatusStatistics) },
    required: false,
    description: "A map of hours of the day to meeting statistics",
  })
  hourOfDayStatistics?: Record<string, MeetingStatusStatistics>;

  @ApiProperty({
    type: Object,
    additionalProperties: { $ref: getSchemaPath(MeetingStatusStatistics) },
    required: false,
    description: "A map of day of the week to meeting statistics",
  })
  dayOfWeekStatistics?: Record<string, MeetingStatusStatistics>;
}

@ApiExtraModels(MeetingStatusStatistics)
export class GetMeetingSummaryResponse {
  @ApiProperty({
    type: Object,
    additionalProperties: { $ref: getSchemaPath(MeetingStatusStatistics) },
    required: false,
    description: "A map of ISO-8601 date strings to meeting statistics",
  })
  statusStatistics?: Record<string, MeetingStatusStatistics>;
}
