import { SingleCalendarItemResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, NotFoundException, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlMeeting,
  toDomainObject,
} from "../../convert/minerva/MeetingConverter";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlDescribeCalendarItemResponse = {
  minerva_meetings_by_pk: GraphQlMeeting;
};

@Controller()
export class DescribeCalendarItemController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/meeting/:meetingId")
  @ApiOperation({
    summary: "Gets a single calendar item by ID",
    description: "Gets a single calendar item by ID",
    operationId: "DescribeCalendarItem",
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
    const queryRequest = gql`
      query DescribeCalendarItem($id: String!) {
        minerva_meetings_by_pk(id: $id) {
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
          id: meetingId,
        },
      );

    if (queryResponse.minerva_meetings_by_pk === null) {
      throw new NotFoundException(
        `Calendar Item with id ${meetingId} not found`,
      );
    }

    if (!queryResponse.minerva_meetings_by_pk) {
      throw new NotFoundException(
        `Calendar Item with id ${meetingId} not found`,
      );
    }

    const meeting = toDomainObject(queryResponse.minerva_meetings_by_pk);
    const responseBody: SingleCalendarItemResponse = {
      item: meeting,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
