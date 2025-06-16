import {
  Meeting,
  UpdateCalendarItemRequest,
  SingleCalendarItemResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
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

type GraphQlUpdateMeetingResponse = {
  update_minerva_meetings_by_pk: GraphQlMeeting;
};

@Controller()
export class UpdateCalendarItemController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/v1/meeting/:meetingId")
  @ApiOperation({
    summary: "Updates an existing note",
    description: "CUpdates an existing node.",
    operationId: "UpdateNote",
    tags: ["Meetings"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "meetingId",
    description: "The ID of the meeting to update",
    type: String,
  })
  @ApiBody({
    type: UpdateCalendarItemRequest,
    required: true,
    description: "Input for the UpdateCalendarItem operation",
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: SingleCalendarItemResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("meetingId") meetingId: string,
    @Body() request: UpdateCalendarItemRequest,
    @Res() response: Response,
  ): Promise<void> {
    console.log(request);

    if (Object.keys(request.item).length === 0) {
      response.status(HttpStatus.NOT_MODIFIED).end();
    }

    const updateRequest = gql`
      mutation UpdateMeeting(
        $id: String!
        $changes: minerva_meetings_set_input = {}
      ) {
        update_minerva_meetings_by_pk(pk_columns: { id: $id }, _set: $changes) {
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

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMeetingResponse>(
        updateRequest,
        { id: meetingId, changes: request.item },
      );

    if (updateResponse.update_minerva_meetings_by_pk === null) {
      response.status(HttpStatus.NOT_FOUND).end();
      return;
    }

    const updatedMeeting: Meeting = toDomainObject(
      updateResponse.update_minerva_meetings_by_pk,
    );

    const responseBody: SingleCalendarItemResponse = {
      item: updatedMeeting,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
