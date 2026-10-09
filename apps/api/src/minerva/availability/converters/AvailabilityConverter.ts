import {
  AvailabilityBlock,
  AvailabilityLevel,
  MeetingAvailability,
} from "@ncfritz/olympus-model";
import moment from "moment";
import { levelOfMeetingStatus } from "../utils/availabilityRules";

/** A `minerva.availability_blocks` row as Hasura returns it. */
export type GraphQlAvailabilityBlock = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  label: string | null;
  createdTime: string;
  lastUpdatedTime: string;
};

/** The columns of a `minerva.meetings` row availability reads. */
export type GraphQlAvailabilityMeeting = {
  id: string;
  subject: string | null;
  start_time: string;
  end_time: string;
  status: string;
  source: string | null;
};

export const toAvailabilityBlock = (
  row: GraphQlAvailabilityBlock,
): AvailabilityBlock => ({
  id: row.id,
  startTime: moment.utc(row.startTime),
  endTime: moment.utc(row.endTime),
  status: row.status as AvailabilityLevel,
  label: row.label ?? undefined,
  createdTime: moment.utc(row.createdTime),
  lastUpdatedTime: moment.utc(row.lastUpdatedTime),
});

/**
 * A meeting with the level it counts for: the one the user set, else its
 * calendar status's. `counted` is false for a calendar that does not count
 * toward busy.
 */
export const toMeetingAvailability = (
  row: GraphQlAvailabilityMeeting,
  override: AvailabilityLevel | undefined,
  excludedSources: Set<string>,
): MeetingAvailability => ({
  meetingId: row.id,
  subject: row.subject ?? undefined,
  startTime: moment.utc(row.start_time),
  endTime: moment.utc(row.end_time),
  calendarStatus: row.status,
  status: override ?? levelOfMeetingStatus(row.status),
  overridden: override !== undefined,
  counted: !(row.source && excludedSources.has(row.source)),
});
