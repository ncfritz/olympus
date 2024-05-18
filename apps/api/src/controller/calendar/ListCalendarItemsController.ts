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
import moment from "moment";
import {
  GraphQlMeeting,
  toDomainObject,
} from "../../convert/minerva/MeetingConverter";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlListCalendarItemsResponse = {
  minerva_meetings: GraphQlMeeting[];
};

@Controller()
export class ListCalendarItemsController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/meetings/:start")
  @ApiOperation({
    summary: "Gets a single calendar item by ID",
    description: "Gets a single calendar item by ID",
    operationId: "ListCalendarItems",
  })
  @ApiTags("Meetings")
  @ApiProduces("application/json")
  @ApiParam({
    name: "start",
    description: "The timestamp to start from",
    type: String,
  })
  @ApiQuery({
    name: "days",
    description: "The number of days to fetch",
    required: false,
    type: Number,
  })
  @ApiOkResponse({
    description: "The calendar items have been successfully fetched.",
    type: ListCalendarItemsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("start") start: string,
    @Query("days") days: number = 1,
    @Res() response: Response,
  ): Promise<void> {
    const startTime = moment(start);
    const endTime = moment(startTime).add({ days: days });

    console.log({
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    });

    const queryRequest = gql`
      query ListCalendarItems($start: timestamptz!, $end: timestamptz!) {
        minerva_meetings(
          where: {
            _or: [
              {
                _and: { start_time: { _gte: $start }, end_time: { _lte: $end } }
              }
              {
                _and: { start_time: { _gte: $start }, end_time: { _gte: $end } }
              }
              {
                _and: { start_time: { _lte: $start }, end_time: { _lte: $end } }
              }
              {
                _and: { start_time: { _lte: $start }, end_time: { _gte: $end } }
              }
            ]
          }
        ) {
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
            attendee_email
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
      await this.graphQLClient.request<GraphQlListCalendarItemsResponse>(
        queryRequest,
        {
          start: startTime,
          end: endTime,
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
