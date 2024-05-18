import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import { SingleCalendarItemResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
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

type GraphQlDescribeCalendarItemResponse = {
  minerva_meetings_by_pk: GraphQlMeeting;
};

@Controller()
export class DescribeCalendarItemController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/meeting/:meetingId")
  @ApiOperation({
    summary: "Gets a single calendar item by ID",
    description: "Gets a single calendar item by ID",
    operationId: "DescribeCalendarItem",
  })
  @ApiTags("Meetings")
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
          end_time
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
      response.status(HttpStatus.NOT_FOUND).end();
      return;
    }

    if (!queryResponse.minerva_meetings_by_pk) {
      throw new NotFoundClientError(
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
