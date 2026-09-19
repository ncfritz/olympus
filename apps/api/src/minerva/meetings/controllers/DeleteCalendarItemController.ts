import { Meeting, SingleCalendarItemResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Delete,
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
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { GraphQlMeeting, toDomainObject } from "../converters/MeetingConverter";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlDeleteCalendarItemResponse = {
  update_minerva_meetings_by_pk: GraphQlMeeting | null;
};

@Controller({ version: "1" })
export class DeleteCalendarItemController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Delete("/meeting/:meetingId")
  @ApiOperation({
    summary: "Soft deletes an existing meeting",
    description: "Soft deletes a meeting.",
    operationId: "DeleteCalendarItem",
    tags: ["Meetings"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "meetingId",
    description: "The ID of the meeting to delete",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: SingleCalendarItemResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("meetingId") meetingId: string,
    @Res() response: Response,
  ): Promise<void> {
    const deleteRequest = gql`
      mutation DeleteCalendarItem($id: String!) {
        update_minerva_meetings_by_pk(
          pk_columns: { id: $id }
          _set: { deleted: true }
        ) {
          id
          uid
          recurrence_id
          all_day
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
          cancelled
          deleted
          duration
          end_time
          importance
          location
          occurrence_type
          organizer {
            alias
            email
            given_name
            surname
            type
          }
          reminder
          response
          sensitivity
          start_time
          status
          source
          subject
          type
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
      throw new NotFoundException(
        `Calendar Item with id ${meetingId} not found`,
      );
    }

    const deletedMeeting: Meeting = toDomainObject(
      deleteResponse.update_minerva_meetings_by_pk,
    );

    const responseBody: SingleCalendarItemResponse = {
      item: deletedMeeting,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
