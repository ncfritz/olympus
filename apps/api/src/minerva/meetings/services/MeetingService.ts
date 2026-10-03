import {
  GetMeetingStatisticsResponse,
  GetMeetingSummaryResponse,
  Meeting,
  MeetingStatus,
  MeetingStatusStatistics,
  PartialMeeting,
} from "@ncfritz/olympus-model";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment-timezone";
import { GraphQlMeeting, toDomainObject } from "../converters/MeetingConverter";
import {
  BASE_MEETING,
  MEETING_WITH_ATTENDEE_EMAILS,
} from "../queries/meetings";

type GraphQlCalendarItemOwnerResponse = {
  minerva_meetings_by_pk: { user_id: string } | null;
};

type GraphQlCreateCalendarItemResponse = {
  insert_minerva_meetings_one: { id: string } | null;
};

type GraphQlDescribeCalendarItemResponse = {
  minerva_meetings: GraphQlMeeting[];
};

type GraphQlUpdateMeetingResponse = {
  update_minerva_meetings: { returning: GraphQlMeeting[] };
};

type GraphQlListCalendarItemsResponse = {
  minerva_meetings: GraphQlMeeting[];
};

type GraphQlGetMeetingStartTimeResponse = {
  minerva_meetings: {
    start_time: string;
    uid?: string;
  }[];
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

/**
 * Columns a change set may not touch: the item's identity and its owner.
 * Change sets arrive as Hasura column names, unchecked.
 */
const PROTECTED_COLUMNS = new Set(["id", "user_id", "userId", "account_id"]);

const withoutProtectedColumns = (changes: PartialMeeting): PartialMeeting =>
  Object.fromEntries(
    Object.entries(changes).filter(
      ([column]) => !PROTECTED_COLUMNS.has(column),
    ),
  ) as PartialMeeting;

/**
 * Minerva calendar items (meetings) in Hasura. Every item, and the people
 * on it, belong to a user (ADR 0028): every method takes the caller's user
 * ID and reads and writes only that user's rows. Another user's item is
 * not found.
 */
@Injectable()
export class MeetingService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * Creates (or upserts) one of the user's calendar items, with its
   * organizer and attendees. An ID that is another user's item is refused.
   * @throws ConflictException
   */
  async create(userId: string, item: Meeting): Promise<Meeting> {
    const ownerRequest = gql`
      query GetCalendarItemOwner($id: String!) {
        minerva_meetings_by_pk(id: $id) {
          user_id
        }
      }
    `;
    const owner =
      await this.graphQLClient.request<GraphQlCalendarItemOwnerResponse>(
        ownerRequest,
        { id: item.id },
      );
    const ownerId = owner.minerva_meetings_by_pk?.user_id;
    if (ownerId !== undefined && ownerId !== userId) {
      throw new ConflictException(
        `Calendar Item with id ${item.id} already exists`,
      );
    }

    // Three inserts in one mutation, so one transaction: the people first
    // (the meeting's organizer and its attendees' rows point at them), then
    // the meeting, then its attendees. The meeting's upsert only updates a
    // row of the same user's, should one appear between the check above and
    // this.
    const insertRequest = gql`
      mutation CreateMeeting(
        $meeting: minerva_meetings_insert_input!
        $people: [minerva_meeting_user_insert_input!]!
        $attendees: [minerva_meeting_attendees_insert_input!]!
        $user_id: uuid!
      ) {
        insert_minerva_meeting_user(
          objects: $people
          on_conflict: {
            constraint: meeting_user_pkey
            update_columns: [alias, given_name, surname, type]
          }
        ) {
          affected_rows
        }
        insert_minerva_meetings_one(
          object: $meeting
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
              organizer_email
              reminder
              response
              sensitivity
              start_time
              status
              subject
              type
            ]
            where: { user_id: { _eq: $user_id } }
          }
        ) {
          id
        }
        insert_minerva_meeting_attendees(
          objects: $attendees
          on_conflict: {
            constraint: meeting_attendees_pkey
            update_columns: [attendance, response]
          }
        ) {
          affected_rows
        }
      }
    `;

    // One row per address: the organizer may also be an attendee, and an
    // upsert cannot touch the same row twice.
    const people = new Map<string, Record<string, unknown>>();
    for (const person of [item.organizer, ...item.attendees]) {
      people.set(person.email, {
        user_id: userId,
        alias: person.alias,
        email: person.email,
        given_name: person.givenName,
        surname: person.surname,
        type: person.type,
      });
    }

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateCalendarItemResponse>(
        insertRequest,
        {
          user_id: userId,
          people: [...people.values()],
          meeting: {
            user_id: userId,
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
            organizer_email: item.organizer.email,
            reminder: item.reminder,
            response: item.response,
            sensitivity: item.sensitivity,
            start_time: item.startTime,
            status: item.status,
            subject: item.subject,
            type: item.type,
          },
          attendees: item.attendees.map((attendee) => {
            return {
              user_id: userId,
              meeting_id: item.id,
              attendee_email: attendee.email,
              attendance: attendee.attendance,
              response: attendee.response,
            };
          }),
        },
      );

    if (!insertResponse.insert_minerva_meetings_one) {
      throw new ConflictException(
        `Calendar Item with id ${item.id} already exists`,
      );
    }

    return this.describe(userId, item.id);
  }

  /** @throws NotFoundException */
  async describe(userId: string, meetingId: string): Promise<Meeting> {
    const queryRequest = gql`
      query DescribeCalendarItem($id: String!, $user_id: uuid!) {
        minerva_meetings(
          where: { id: { _eq: $id }, user_id: { _eq: $user_id } }
          limit: 1
        ) {
          ${BASE_MEETING}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlDescribeCalendarItemResponse>(
        queryRequest,
        {
          id: meetingId,
          user_id: userId,
        },
      );

    const meeting = queryResponse.minerva_meetings[0];
    if (!meeting) throw notFound(meetingId);
    return toDomainObject(meeting);
  }

  /** Applies `changes` (Hasura column names) to a calendar item. @throws NotFoundException */
  async update(
    userId: string,
    meetingId: string,
    changes: PartialMeeting,
  ): Promise<Meeting> {
    const updateRequest = gql`
      mutation UpdateMeeting(
        $id: String!
        $user_id: uuid!
        $changes: minerva_meetings_set_input = {}
      ) {
        update_minerva_meetings(
          where: { id: { _eq: $id }, user_id: { _eq: $user_id } }
          _set: $changes
        ) {
          returning {
            ${MEETING_WITH_ATTENDEE_EMAILS}
          }
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMeetingResponse>(
        updateRequest,
        {
          id: meetingId,
          user_id: userId,
          changes: withoutProtectedColumns(changes),
        },
      );

    const meeting = updateResponse.update_minerva_meetings.returning[0];
    if (!meeting) throw notFound(meetingId);
    return toDomainObject(meeting);
  }

  /** Soft-deletes a calendar item. @throws NotFoundException */
  async delete(userId: string, meetingId: string): Promise<Meeting> {
    const deleteRequest = gql`
      mutation DeleteCalendarItem($id: String!, $user_id: uuid!) {
        update_minerva_meetings(
          where: { id: { _eq: $id }, user_id: { _eq: $user_id } }
          _set: { deleted: true }
        ) {
          returning {
            ${MEETING_WITH_ATTENDEE_EMAILS}
          }
        }
      }
    `;

    const deleteResponse =
      await this.graphQLClient.request<GraphQlUpdateMeetingResponse>(
        deleteRequest,
        {
          id: meetingId,
          user_id: userId,
        },
      );

    const meeting = deleteResponse.update_minerva_meetings.returning[0];
    if (!meeting) throw notFound(meetingId);
    return toDomainObject(meeting);
  }

  /** Lists the calendar items in the `days` days from `start`. */
  async list(userId: string, start: string, days: number): Promise<Meeting[]> {
    const startTime = moment(start);
    const endTime = moment(startTime).add({ days: days });
    //               {
    //                 _and: { start_time: { _lte: $start }, end_time: { _lte: $end } }
    //               },
    //               {
    //                 _and: { start_time: { _gte: $start }, end_time: { _gte: $end } }
    //               }

    const queryRequest = gql`
      query ListCalendarItems(
        $start: timestamptz!
        $end: timestamptz!
        $user_id: uuid!
      ) {
        minerva_meetings(
          where: {
            user_id: { _eq: $user_id }
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
          user_id: userId,
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
  async getNextOccurrence(
    userId: string,
    meetingId: string,
  ): Promise<Meeting | undefined> {
    const current = await this.getSeriesPosition(userId, meetingId);

    const queryRequest = gql`
      query GetNextCalendarItemOccurrence(
        $uid: String!
        $current_start_time: timestamptz!
        $user_id: uuid!
      ) {
        minerva_meetings(
          where: {
            _and: {
              user_id: { _eq: $user_id }
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
          user_id: userId,
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
    userId: string,
    meetingId: string,
    limit: number,
  ): Promise<Meeting[]> {
    const current = await this.getSeriesPosition(userId, meetingId);

    const queryRequest = gql`
      query ListPreviousCalendarItemOccurrences(
        $uid: String!
        $current_start_time: timestamptz!
        $limit: Int!
        $user_id: uuid!
      ) {
        minerva_meetings(
          where: {
            _and: {
              user_id: { _eq: $user_id }
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
          user_id: userId,
        },
      );

    return queryResponse.minerva_meetings.map((meeting) => {
      return toDomainObject(meeting);
    });
  }

  /** Meeting counts by status for each day of the period, in `tz`. */
  async getSummary(
    userId: string,
    tz: string,
    start: string,
    days: number,
  ): Promise<GetMeetingSummaryResponse> {
    const startDate = moment(start);
    const endDate = moment(startDate).add(days + 1, "days");
    const queryInput = {
      user_id: userId,
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
        $user_id: uuid!
        $tz: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_meeting_status_statistics(
          args: {
            for_user: $user_id
            start_date: $start
            end_date: $end
            tz: $tz
          }
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
    userId: string,
    tz: string,
    start: string,
    days: number,
  ): Promise<GetMeetingStatisticsResponse> {
    const startDate = moment(start);
    const endDate = moment(startDate)
      .add(days + 1, "days")
      .subtract(1, "second");
    const queryInput = {
      user_id: userId,
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
        $user_id: uuid!
        $tz: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_meeting_hour_statistics(
          args: {
            for_user: $user_id
            start_date: $start
            end_date: $end
            tz: $tz
          }
        ) {
          count
          duration
          hour
          status
        }
        minerva_meeting_day_statistics(
          args: {
            for_user: $user_id
            start_date: $start
            end_date: $end
            tz: $tz
          }
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
  private async getSeriesPosition(
    userId: string,
    meetingId: string,
  ): Promise<SeriesPosition> {
    const currentMeetingQueryRequest = gql`
      query GetCalendarItemSeries($id: String!, $user_id: uuid!) {
        minerva_meetings(
          where: { id: { _eq: $id }, user_id: { _eq: $user_id } }
          limit: 1
        ) {
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
          user_id: userId,
        },
      );

    const current = currentMeetingQueryResponse.minerva_meetings[0];
    if (!current?.uid) {
      throw notFound(meetingId);
    }

    return {
      uid: current.uid,
      start_time: current.start_time,
    };
  }
}
