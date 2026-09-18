import {
  Meeting,
  MeetingAttendee,
  MeetingImportance,
  MeetingOccurrenceType,
  MeetingSensitivity,
  MeetingStatus,
  MeetingSource,
  MeetingUser,
} from "@ncfritz/olympus-model";
import moment from "moment";

export type GraphQlMeeting = {
  id: string;
  uid: string;
  recurrence_id: string;
  type: string;
  subject: string;
  status: MeetingStatus;
  source: MeetingSource;
  start_time: string;
  end_time: string;
  sensitivity: MeetingSensitivity;
  response: string;
  reminder: string;
  organizer: GraphQlMeetingUser;
  occurrence_type: MeetingOccurrenceType;
  location: string;
  importance: MeetingImportance;
  duration: string;
  deleted: boolean;
  cancelled: boolean;
  all_day: boolean;
  attendees: GraphQlMeetingAttendee[];
};

export type GraphQlMeetingUser = {
  email: string;
  alias: string;
  given_name: string;
  surname: string;
  type: string;
};

export type GraphQlMeetingAttendee = {
  user: GraphQlMeetingUser;
  attendance: string;
  response: string;
};

const buildMeetingUser = (input: GraphQlMeetingUser): MeetingUser => {
  return {
    email: input.email,
    alias: input.alias,
    givenName: input.given_name,
    surname: input.surname,
    type: input.type,
  };
};

const buildMeetingAttendee = (
  input: GraphQlMeetingAttendee,
): MeetingAttendee => {
  return {
    ...buildMeetingUser(input.user),
    attendance: input.attendance,
    response: input.response,
  };
};

export const toDomainObject = (input: GraphQlMeeting): Meeting => {
  const attendees: MeetingAttendee[] = [];

  input.attendees.forEach((inputAttendee) => {
    attendees.push(buildMeetingAttendee(inputAttendee));
  });

  return {
    id: input.id,
    uid: input.uid,
    recurrenceId: input.recurrence_id,
    type: input.type,
    subject: input.subject,
    status: input.status,
    source: input.source || MeetingSource.UNKNOWN,
    startTime: moment(input.start_time),
    endTime: input.end_time ? moment(input.end_time) : undefined,
    sensitivity: input.sensitivity,
    response: input.response,
    reminder: input.reminder,
    organizer: buildMeetingUser(input.organizer),
    occurrenceType: input.occurrence_type,
    location: input.location,
    importance: input.importance,
    duration: moment.duration(input.duration).minutes(),
    isDeleted: input.deleted,
    isCancelled: input.cancelled,
    isAllDay: input.all_day,
    attendees: attendees,
  };
};
