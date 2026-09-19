import {
  GetMeetingStatisticsResponse,
  GetMeetingSummaryResponse,
  Meeting,
  MeetingStatus,
  MeetingStatusStatistics,
  PartialMeeting,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment-timezone";
import { GraphQlMeeting, toDomainObject } from "../converters/MeetingConverter";
import {
  BASE_MEETING,
  MEETING_ATTENDEE,
  MEETING_CORE,
  MEETING_WITH_ATTENDEE_EMAILS,
} from "../queries/meetings";

type GraphQlCreateCalendarItemResponse = {
  insert_minerva_meetings_one: GraphQlMeeting;
};

type GraphQlDescribeCalendarItemResponse = {
  minerva_meetings_by_pk: GraphQlMeeting;
};

type GraphQlUpdateMeetingResponse = {
  update_minerva_meetings_by_pk: GraphQlMeeting;
};

type GraphQlDeleteCalendarItemResponse = {
  update_minerva_meetings_by_pk: GraphQlMeeting | null;
};

type GraphQlListCalendarItemsResponse = {
  minerva_meetings: GraphQlMeeting[];
};

type GraphQlGetMeetingStartTimeResponse = {
  minerva_meetings_by_pk: {
    start_time: string;
    uid?: string;
  };
};

type GraphQlGetMeetingsSummaryResponse = {
  minerva_meeting_status_statistics: [
    {
      count: number;
      duration: number;
      start_date: string;
      status: MeetingStatus;
    },
  ];
};

type GraphQlGetMeetingsStatisticsResponse = {
  minerva_meeting_hour_statistics: [
    {
      count: number;
      duration: number;
      hour: string;
      status: MeetingStatus;
    },
  ];
  minerva_meeting_day_statistics: [
    {
      count: number;
      duration: number;
      day: string;
      status: MeetingStatus;
    },
  ];
};

/** The series a meeting belongs to, and where the meeting sits in it. */
type SeriesPosition = {
  uid: string;
  start_time: string;
};

const EMPTY_COUNTS = (): MeetingStatusStatistics => {
  return {
    [MeetingStatus.Free]: { count: 0, totalDurationMin: 0 },
    [MeetingStatus.Busy]: { count: 0, totalDurationMin: 0 },
    [MeetingStatus.Tentative]: { count: 0, totalDurationMin: 0 },
    [MeetingStatus.OOF]: { count: 0, totalDurationMin: 0 },
    [MeetingStatus.NoData]: { count: 0, totalDurationMin: 0 },
    [MeetingStatus.WorkingElsewhere]: { count: 0, totalDurationMin: 0 },
  };
};

const notFound = (meetingId: string) =>
  new NotFoundException(`Calendar Item with id ${meetingId} not found`);

/** Minerva calendar items (meetings) in Hasura. */
@Injectable()
export class MeetingService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Creates (or upserts) a calendar item. */
  async create(item: Meeting): Promise<Meeting> {
    const insertRequest = gql`
      mutation CreateMeeting(
        $all_day: Boolean!
        $cancelled: Boolean!
        $deleted: Boolean!
        $duration: numeric!
        $end_time: timestamptz!
        $id: String!
        $uid: String
        $recurrence_id: String
        $importance: String!
        $location: String!
        $occurrence_type: String!
        $reminder: Boolean!
        $response: String!
        $sensitivity: String!
        $start_time: timestamptz!
        $status: String!
        $source: String!
        $subject: String!
        $type: String!
        $attendees: [minerva_meeting_attendees_insert_input!]!
        $organizer: minerva_meeting_user_insert_input!
      ) {
        insert_minerva_meetings_one(
          object: {
            all_day: $all_day
            cancelled: $cancelled
            deleted: $deleted
            duration: $duration
            end_time: $end_time
            id: $id
            uid: $uid
            recurrence_id: $recurrence_id
            importance: $importance
            location: $location
            occurrence_type: $occurrence_type
            reminder: $reminder
            response: $response
            sensitivity: $sensitivity
            start_time: $start_time
            status: $status
            source: $source
            subject: $subject
            type: $type
            organizer: {
              data: $organizer
              on_conflict: {
                constraint: meeting_user_pkey
                update_columns: [alias, given_name, surname, type]
              }
            }
            attendees: {
              data: $attendees
              on_conflict: {
                constraint: meeting_attendees_pkey
                update_columns: [attendance, response]
              }
            }
          }
          on_conflict: {
            constraint: meetings_pkey
            update_columns: [
              uid
              recurrence_id
              all_day
              cancelled
              deleted
              duration
              end_time
              importance
              location
              occurrence_type
              reminder
              response
              sensitivity
              start_time
              status
              subject
              type
            ]
          }
        ) {
          ${MEETING_CORE}
          attendees {
            ${MEETING_ATTENDEE}
          }
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateCalendarItemResponse>(
        insertRequest,
        {
          all_day: item.isAllDay,
          cancelled: item.isCancelled,
          deleted: false,
          duration: item.duration,
          end_time: item.endTime,
          id: item.id,
          uid: item.uid,
          recurrence_id: item.recurrenceId,
          source: item.source,
          importance: item.importance,
          location: item.location,
          occurrence_type: item.occurrenceType,
          reminder: item.reminder,
          response: item.response,
          sensitivity: item.sensitivity,
          start_time: item.startTime,
          status: item.status,
          subject: item.subject,
          type: item.type,
          organizer: {
            alias: item.organizer.alias,
            email: item.organizer.email,
            given_name: item.organizer.givenName,
            surname: item.organizer.surname,
            type: item.organizer.type,
          },
          attendees: item.attendees.map((attendee) => {
            return {
              attendance: attendee.attendance,
              response: attendee.response,
              user: {
                data: {
                  alias: attendee.alias,
                  email: attendee.email,
                  given_name: attendee.givenName,
                  surname: attendee.surname,
                  type: attendee.type,
                },
                on_conflict: {
                  constraint: "meeting_user_pkey",
                  update_columns: ["alias", "given_name", "surname", "type"],
                },
              },
            };
          }),
        },
      );

    return toDomainObject(insertResponse.insert_minerva_meetings_one);
  }

  /** @throws NotFoundException */
  async describe(meetingId: string): Promise<Meeting> {
    const queryRequest = gql`
      query DescribeCalendarItem($id: String!) {
        minerva_meetings_by_pk(id: $id) {
          ${BASE_MEETING}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlDescribeCalendarItemResponse>(
        queryRequest,
        {
          id: meetingId,
        },
      );

    if (!queryResponse.minerva_meetings_by_pk) throw notFound(meetingId);
    return toDomainObject(queryResponse.minerva_meetings_by_pk);
  }

  /** Applies `changes` (Hasura column names) to a calendar item. @throws NotFoundException */
  async update(meetingId: string, changes: PartialMeeting): Promise<Meeting> {
    const updateRequest = gql`
      mutation UpdateMeeting(
        $id: String!
        $changes: minerva_meetings_set_input = {}
      ) {
        update_minerva_meetings_by_pk(pk_columns: { id: $id }, _set: $changes) {
          ${MEETING_WITH_ATTENDEE_EMAILS}
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMeetingResponse>(
        updateRequest,
        { id: meetingId, changes: changes },
      );

    if (updateResponse.update_minerva_meetings_by_pk === null) {
      throw notFound(meetingId);
    }

    return toDomainObject(updateResponse.update_minerva_meetings_by_pk);
  }

  /** Soft-deletes a calendar item. @throws NotFoundException */
  async delete(meetingId: string): Promise<Meeting> {
    const deleteRequest = gql`
      mutation DeleteCalendarItem($id: String!) {
        update_minerva_meetings_by_pk(
          pk_columns: { id: $id }
          _set: { deleted: true }
        ) {
          ${MEETING_WITH_ATTENDEE_EMAILS}
        }
      }
    `;

    const deleteResponse =
      await this.graphQLClient.request<GraphQlDeleteCalendarItemResponse>(
        deleteRequest,
        {
          id: meetingId,
        },
      );

    if (deleteResponse.update_minerva_meetings_by_pk === null) {
      throw notFound(meetingId);
    }

    return toDomainObject(deleteResponse.update_minerva_meetings_by_pk);
  }

  /** Lists the calendar items in the `days` days from `start`. */
  async list(start: string, days: number): Promise<Meeting[]> {
    const startTime = moment(start);
    const endTime = moment(startTime).add({ days: days });
    //               {
    //                 _and: { start_time: { _lte: $start }, end_time: { _lte: $end } }
    //               },
    //               {
    //                 _and: { start_time: { _gte: $start }, end_time: { _gte: $end } }
    //               }

    const queryRequest = gql`
      query ListCalendarItems($start: timestamptz!, $end: timestamptz!) {
        minerva_meetings(
          where: {
            _or: [
              {
                _and: { start_time: { _gte: $start }, end_time: { _lte: $end } }
              }
              {
                _and: { start_time: { _lte: $start }, end_time: { _gte: $end } }
              }
            ]
          }
        ) {
          ${MEETING_WITH_ATTENDEE_EMAILS}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListCalendarItemsResponse>(
        queryRequest,
        {
          start: startTime,
          end: endTime,
        },
      );

    return queryResponse.minerva_meetings.map((meeting) => {
      return toDomainObject(meeting);
    });
  }

  /**
   * The next occurrence of a meeting's series, if any.
   * @throws NotFoundException
   */
  async getNextOccurrence(meetingId: string): Promise<Meeting | undefined> {
    const current = await this.getSeriesPosition(meetingId);

    const queryRequest = gql`
      query GetNextCalendarItemOccurrence(
        $uid: String!
        $current_start_time: timestamptz!
      ) {
        minerva_meetings(
          where: {
            _and: {
              uid: { _eq: $uid }
              start_time: { _gt: $current_start_time }
            }
          }
          limit: 1
          order_by: { start_time: asc }
        ) {
          ${BASE_MEETING}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListCalendarItemsResponse>(
        queryRequest,
        {
          uid: current.uid,
          current_start_time: current.start_time,
        },
      );

    return queryResponse.minerva_meetings.length > 0
      ? toDomainObject(queryResponse.minerva_meetings[0])
      : undefined;
  }

  /**
   * Up to `limit` earlier occurrences of a meeting's series, latest first.
   * @throws NotFoundException
   */
  async listPreviousOccurrences(
    meetingId: string,
    limit: number,
  ): Promise<Meeting[]> {
    const current = await this.getSeriesPosition(meetingId);

    const queryRequest = gql`
      query ListPreviousCalendarItemOccurrences(
        $uid: String!
        $current_start_time: timestamptz!
        $limit: Int!
      ) {
        minerva_meetings(
          where: {
            _and: {
              uid: { _like: $uid }
              start_time: { _lt: $current_start_time }
            }
          }
          limit: $limit
          order_by: { start_time: desc }
        ) {
          ${BASE_MEETING}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListCalendarItemsResponse>(
        queryRequest,
        {
          uid: current.uid,
          current_start_time: current.start_time,
          limit: limit,
        },
      );

    return queryResponse.minerva_meetings.map((meeting) => {
      return toDomainObject(meeting);
    });
  }

  /** Meeting counts by status for each day of the period, in `tz`. */
  async getSummary(
    tz: string,
    start: string,
    days: number,
  ): Promise<GetMeetingSummaryResponse> {
    const startDate = moment(start);
    const endDate = moment(startDate).add(days + 1, "days");
    const queryInput = {
      start: startDate,
      end: endDate,
      tz: tz,
    };
    const statusStatistics: Record<string, MeetingStatusStatistics> = {};

    for (let m = moment(startDate), i = 0; i <= days; m.add(1, "days"), i++) {
      statusStatistics[m.format("YYYY-MM-DD")] = EMPTY_COUNTS();
    }

    const statisticsRequest = gql`
      query GetMeetingsSummary(
        $tz: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_meeting_status_statistics(
          args: { start_date: $start, end_date: $end, tz: $tz }
        ) {
          count
          duration
          status
          start_date
        }
      }
    `;

    const statisticsResponse =
      await this.graphQLClient.request<GraphQlGetMeetingsSummaryResponse>(
        statisticsRequest,
        queryInput,
      );

    statisticsResponse.minerva_meeting_status_statistics.forEach((entry) => {
      if (!(entry.start_date in statusStatistics)) {
        return;
      }

      statusStatistics[entry.start_date][entry.status].count += entry.count;
      statusStatistics[entry.start_date][entry.status].totalDurationMin +=
        entry.duration;
    });

    return {
      statusStatistics: statusStatistics,
    };
  }

  /** Meeting counts by status per hour of day and day of week, in `tz`. */
  async getStatistics(
    tz: string,
    start: string,
    days: number,
  ): Promise<GetMeetingStatisticsResponse> {
    const startDate = moment(start);
    const endDate = moment(startDate)
      .add(days + 1, "days")
      .subtract(1, "second");
    const queryInput = {
      start: startDate,
      end: endDate,
      tz: tz,
    };

    const hourOfDayStatistics: Record<string, MeetingStatusStatistics> = {};
    const dayOfWeekStatistics: Record<string, MeetingStatusStatistics> = {};

    for (let i = 0; i < 24; i++) {
      hourOfDayStatistics[i.toString().padStart(2, "0")] = EMPTY_COUNTS();
    }

    for (let i = 1; i <= 7; i++) {
      dayOfWeekStatistics[i.toString()] = EMPTY_COUNTS();
    }

    const statisticsRequest = gql`
      query GetMeetingsStatistics(
        $tz: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_meeting_hour_statistics(
          args: { start_date: $start, end_date: $end, tz: $tz }
        ) {
          count
          duration
          hour
          status
        }
        minerva_meeting_day_statistics(
          args: { start_date: $start, end_date: $end, tz: $tz }
        ) {
          count
          day
          duration
          status
        }
      }
    `;

    const statisticsResponse =
      await this.graphQLClient.request<GraphQlGetMeetingsStatisticsResponse>(
        statisticsRequest,
        queryInput,
      );

    statisticsResponse.minerva_meeting_hour_statistics.forEach((entry) => {
      hourOfDayStatistics[entry.hour][entry.status].count += entry.count;
      hourOfDayStatistics[entry.hour][entry.status].totalDurationMin +=
        entry.duration;
    });

    statisticsResponse.minerva_meeting_day_statistics.forEach((entry) => {
      dayOfWeekStatistics[entry.day][entry.status].count += entry.count;
      dayOfWeekStatistics[entry.day][entry.status].totalDurationMin +=
        entry.duration;
    });

    return {
      hourOfDayStatistics: hourOfDayStatistics,
      dayOfWeekStatistics: dayOfWeekStatistics,
    };
  }

  /** The series uid and start time of a meeting. @throws NotFoundException */
  private async getSeriesPosition(meetingId: string): Promise<SeriesPosition> {
    const currentMeetingQueryRequest = gql`
      query GetCalendarItemSeries($id: String!) {
        minerva_meetings_by_pk(id: $id) {
          start_time
          uid
        }
      }
    `;

    const currentMeetingQueryResponse =
      await this.graphQLClient.request<GraphQlGetMeetingStartTimeResponse>(
        currentMeetingQueryRequest,
        {
          id: meetingId,
        },
      );

    if (!currentMeetingQueryResponse.minerva_meetings_by_pk?.uid) {
      throw notFound(meetingId);
    }

    return {
      uid: currentMeetingQueryResponse.minerva_meetings_by_pk.uid,
      start_time: currentMeetingQueryResponse.minerva_meetings_by_pk.start_time,
    };
  }
}
