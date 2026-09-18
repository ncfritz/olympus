import { ListCalendarItemsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  Res,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlMeeting,
  toDomainObject,
} from "../../../convert/minerva/MeetingConverter";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlGetMeetingStartTimeResponse = {
  minerva_meetings_by_pk: {
    start_time: string;
    uid?: string;
  };
};

type GraphQlDescribeCalendarItemResponse = {
  minerva_meetings: GraphQlMeeting[];
};

@Controller({ version: "1" })
export class ListPreviousCalendarItemOccurrencesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/meeting/:meetingId/previous")
  @ApiOperation({
    summary: "Lists previous occurrences of a meeting in a series",
    description:
      "Lists earlier occurrences of a recurring meeting, up to the requested limit.",
    operationId: "ListPreviousCalendarItemOccurrences",
    tags: ["Meetings"],
  })
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
  @UsePipes(new ValidationPipe({ transform: true }))
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
      throw new NotFoundException(
        `Calendar Item with id ${meetingId} not found`,
      );
    }

    if (!currentMeetingQueryResponse.minerva_meetings_by_pk) {
      throw new NotFoundException(
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
          limit: $limit
          order_by: { start_time: desc }
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
