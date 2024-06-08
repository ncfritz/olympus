import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import { SingleCalendarItemResponse, Meeting } from "@ncfritz/olympus-model";
import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
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
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlDeleteCalendarItemResponse = {
  update_minerva_meetings_by_pk: GraphQlMeeting;
};

@Controller()
export class DeleteCalendarItemController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Delete("/v1/meeting/:meetingId")
  @ApiOperation({
    summary: "Soft deletes an existing meeting",
    description: "Soft deletes a meeting.",
    operationId: "DeleteCalendarItem",
  })
  @ApiTags("Meetings")
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

    const createdMeeting: Meeting = toDomainObject(
      deleteResponse.update_minerva_meetings_by_pk,
    );

    const responseBody: SingleCalendarItemResponse = {
      item: createdMeeting,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
