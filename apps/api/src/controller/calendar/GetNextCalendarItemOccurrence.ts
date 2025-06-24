import { SingleCalendarItemResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { NotFoundError } from "rxjs";
import {
  GraphQlMeeting,
  toDomainObject,
} from "../../convert/minerva/MeetingConverter";
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
export class GetNextCalendarItemOccurrenceController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/meeting/:meetingId/next")
  @ApiOperation({
    summary: "Gets the next occurrence of a meeting in a series",
    description: "Gets the next occurrence of a meeting in a series",
    operationId: "GetNextCalendarItemOccurrence",
    tags: ["Meetings"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "meetingId",
    description: "The ID of the meeting to retrieve",
    type: String,
  })
  @ApiOkResponse({
    description: "The calendar item have been successfully fetched.",
    type: SingleCalendarItemResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("meetingId") meetingId: string,
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
      throw new NotFoundException(
        `Calendar Item with id ${meetingId} not found`,
      );
    }

    if (!currentMeetingQueryResponse.minerva_meetings_by_pk) {
      throw new NotFoundError(`Calendar Item with id ${meetingId} not found`);
    }

    const queryRequest = gql`
      query DescribeCalendarItem(
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
        },
      );

    const meeting =
      queryResponse.minerva_meetings.length > 0
        ? toDomainObject(queryResponse.minerva_meetings[0])
        : undefined;
    const responseBody: SingleCalendarItemResponse = {
      item: meeting,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
