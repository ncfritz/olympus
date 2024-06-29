import { ApiProperty, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";

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
  AMZN = "AMZN",
}

export class Meeting {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  uid?: string;

  @ApiProperty({ type: String })
  recurrenceId?: string;

  @ApiProperty({ type: String })
  subject: string;

  @ApiProperty({ enum: MeetingSensitivity })
  sensitivity: MeetingSensitivity;

  @ApiProperty({ enum: MeetingImportance })
  importance: MeetingImportance;

  @ApiProperty({ enum: MeetingOccurrenceType })
  occurrenceType: MeetingOccurrenceType;

  @ApiProperty({ type: String })
  type: string;

  @ApiProperty({ type: String })
  reminder: string;

  @ApiProperty({ type: String })
  response: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  startTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  endTime?: Moment;

  @ApiProperty({ type: Number })
  duration: number;

  @ApiProperty({ type: Boolean })
  isAllDay: boolean;

  @ApiProperty({ type: Boolean })
  isDeleted: boolean;

  @ApiProperty({ enum: MeetingSource })
  source: MeetingSource;

  @ApiProperty({ enum: MeetingStatus })
  status: MeetingStatus;

  @ApiProperty({ type: String })
  location: string;

  @ApiProperty({ type: Boolean })
  isCancelled: boolean;

  @ApiProperty({ type: () => MeetingUser })
  organizer: MeetingUser;

  @ApiProperty({ type: () => MeetingAttendee, isArray: true })
  attendees: MeetingAttendee[];
}

export class PartialMeeting extends PartialType(Meeting) {}

export class MeetingUser {
  @ApiProperty({ type: String })
  email: string;

  @ApiProperty({ type: String })
  alias?: string;

  @ApiProperty({ type: String })
  givenName: string;

  @ApiProperty({ type: String })
  surname?: string;

  @ApiProperty({ type: String })
  type: string;
}

class MeetingTimeStatistic {
  @ApiProperty({ type: Number })
  totalDurationMin: number;

  @ApiProperty({ type: Number })
  count: number;
}

export class MeetingStatusStatistics {
  @ApiProperty({
    type: () => MeetingTimeStatistic,
  })
  [MeetingStatus.Free]: MeetingTimeStatistic;

  @ApiProperty({
    type: () => MeetingTimeStatistic,
  })
  [MeetingStatus.Busy]: MeetingTimeStatistic;

  @ApiProperty({
    type: () => MeetingTimeStatistic,
  })
  [MeetingStatus.Tentative]: MeetingTimeStatistic;

  @ApiProperty({
    type: () => MeetingTimeStatistic,
  })
  [MeetingStatus.OOF]: MeetingTimeStatistic;

  @ApiProperty({
    type: () => MeetingTimeStatistic,
  })
  [MeetingStatus.NoData]: MeetingTimeStatistic;

  @ApiProperty({
    type: () => MeetingTimeStatistic,
  })
  [MeetingStatus.WorkingElsewhere]: MeetingTimeStatistic;
}

export class MeetingAttendee extends MeetingUser {
  @ApiProperty({ type: String })
  attendance: string;

  @ApiProperty({ type: String })
  response: string;
}

export class CreateCalendarItemRequest {
  @ApiProperty({
    type: () => Meeting,
  })
  item: Meeting;
}

export class UpdateCalendarItemRequest {
  @ApiProperty({
    type: () => PartialMeeting,
  })
  item: PartialMeeting;
}

export class SingleCalendarItemResponse {
  @ApiProperty({
    type: () => Meeting,
  })
  item: Meeting;
}

export class ListCalendarItemsResponse {
  @ApiProperty({
    type: () => Meeting,
    isArray: true,
  })
  items: Meeting[];
}

export class GetMeetingSummaryStatisticsResponse {
  @ApiProperty({
    type: () => MeetingStatusStatistics,
  })
  hourOfDayStatistics: Record<string, MeetingStatusStatistics>;

  @ApiProperty({
    type: () => MeetingStatusStatistics,
  })
  dayOfWeekStatistics: Record<string, MeetingStatusStatistics>;

  @ApiProperty({
    type: () => MeetingStatusStatistics,
  })
  statusStatistics: Record<string, MeetingStatusStatistics>;
}

export class GetMeetingStatusStatisticsResponse {
  @ApiProperty({
    type: () => MeetingStatusStatistics,
  })
  statusStatistics: Record<string, MeetingStatusStatistics>;
}
