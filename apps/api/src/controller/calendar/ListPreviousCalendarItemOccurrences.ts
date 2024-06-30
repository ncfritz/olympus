import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import { ListCalendarItemsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlMeeting,
  toDomainObject,
} from "../../convert/minerva/MeetingConverter";
import { NotFoundClientError } from "../../error";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlGetMeetingStartTimeResponse = {
  minerva_meetings_by_pk: {
    start_time: string;
    uid?: string;
  };
};

type GraphQlDescribeCalendarItemResponse = {
  minerva_meetings: GraphQlMeeting[];
};

@Controller()
export class ListPreviousCalendarItemOccurrencesController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/meeting/:meetingId/previous")
  @ApiOperation({
    summary: "Gets the next occurrence of a meeting in a series",
    description: "Gets the next occurrence of a meeting in a series",
    operationId: "ListPreviousCalendarItemOccurrences",
  })
  @ApiTags("Meetings")
  @ApiProduces("application/json")
  @ApiParam({
    name: "meetingId",
    description: "The ID of the meeting to retrieve",
    type: String,
  })
  @ApiQuery({
    name: "limit",
    description: "The number of past meetings to fetch",
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    description: "The calendar item have been successfully fetched.",
    type: ListCalendarItemsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("meetingId") meetingId: string,
    @Query("limit") limit: number = 5,
    @Res() response: Response,
  ): Promise<void> {
    const currentMeetingQueryRequest = gql`
      query DescribeCalendarItem($id: String!) {
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
      response.status(HttpStatus.NOT_FOUND).end();
      return;
    }

    if (!currentMeetingQueryResponse.minerva_meetings_by_pk) {
      throw new NotFoundClientError(
        `Calendar Item with id ${meetingId} not found`,
      );
    }

    const queryRequest = gql`
      query DescribeCalendarItem(
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
          limit: $limit,
          order_by: {start_time: desc}
        ) {
          all_day
          type
          subject
          status
          source
          start_time
          sensitivity
          response
          reminder
          organizer {
            alias
            email
            given_name
            surname
            type
          }
          occurrence_type
          location
          importance
          id
          uid
          recurrence_id
          end_time
          deleted
          duration
          cancelled
          attendees {
            attendance
            response
            user {
              alias
              email
              given_name
              surname
              type
            }
          }
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlDescribeCalendarItemResponse>(
        queryRequest,
        {
          uid: currentMeetingQueryResponse.minerva_meetings_by_pk.uid,
          current_start_time:
            currentMeetingQueryResponse.minerva_meetings_by_pk.start_time,
          limit: limit,
        },
      );

    const meetings = queryResponse.minerva_meetings.map((meeting) => {
      return toDomainObject(meeting);
    });

    const responseBody: ListCalendarItemsResponse = {
      items: meetings,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
