import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import {
  CreateCalendarItemRequest,
  SingleCalendarItemResponse,
  Meeting,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
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

type GraphQlCreateCalendarItemResponse = {
  insert_minerva_meetings_one: GraphQlMeeting;
};

@Controller()
export class CreateCalendarItemController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Post("/v1/meetings")
  @ApiOperation({
    summary: "Creates a new note",
    description: "Creates a new note.",
    operationId: "CreateCalendarItem",
  })
  @ApiTags("Meetings")
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCalendarItemRequest,
    required: true,
    description: "Input for the CreateCalendarItemRequest operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleCalendarItemResponse,
    headers: {
      Location: {
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateCalendarItemRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateMeeting(
        $all_day: Boolean!
        $cancelled: Boolean!
        $deketed: Boolean!
        $duration: numeric!
        $end_time: timestamptz!
        $id: String!
        $importance: String!
        $location: String!
        $occurrence_type: String!
        $reminder: Boolean!
        $response: String!
        $sensitivity: String!
        $start_time: timestamptz!
        $status: String!
        $subject: String!
        $type: String!
        $attendees: [minerva_meeting_attendees_insert_input!]!
        $organizer: minerva_meeting_user_insert_input!
      ) {
        insert_minerva_meetings_one(
          object: {
            all_day: $all_day
            cancelled: $cancelled
            deleted: $deleted
            duration: $duration
            end_time: $end_time
            id: $id
            importance: $importance
            location: $location
            occurrence_type: $occurrence_type
            reminder: $reminder
            response: $response
            sensitivity: $sensitivity
            start_time: $start_time
            status: $status
            subject: $subject
            type: $type
            organizer: {
              data: $organizer
              on_conflict: {
                constraint: meeting_user_pkey
                update_columns: [alias, given_name, surname, type]
              }
            }
            attendees: {
              data: $attendees
              on_conflict: {
                constraint: meeting_attendees_pkey
                update_columns: [attendance, response]
              }
            }
          }
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

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateCalendarItemResponse>(
        insertRequest,
        {
          all_day: request.item.isAllDay,
          cancelled: request.item.isCancelled,
          duration: request.item.duration,
          end_time: request.item.endTime,
          id: request.item.id,
          importance: request.item.importance,
          location: request.item.location,
          occurrence_type: request.item.occurrenceType,
          reminder: request.item.reminder,
          response: request.item.response,
          sensitivity: request.item.sensitivity,
          start_time: request.item.startTime,
          status: request.item.status,
          subject: request.item.subject,
          type: request.item.type,
          organizer: {
            alias: request.item.organizer.alias,
            email: request.item.organizer.email,
            given_name: request.item.organizer.givenName,
            surname: request.item.organizer.surname,
            type: request.item.organizer.type,
          },
          attendees: request.item.attendees.map((attendee) => {
            return {
              attendance: attendee.attendance,
              response: attendee.response,
              user: {
                data: {
                  alias: attendee.alias,
                  email: attendee.email,
                  given_name: attendee.givenName,
                  surname: attendee.surname,
                  type: attendee.type,
                },
                on_conflict: {
                  constraint: "meeting_user_pkey",
                  update_columns: ["alias", "given_name", "surname", "type"],
                },
              },
            };
          }),
        },
      );

    const createdMeeting: Meeting = toDomainObject(
      insertResponse.insert_minerva_meetings_one,
    );

    const responseBody: SingleCalendarItemResponse = {
      item: createdMeeting,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/v1/meetings/${encodeURIComponent(
          createdMeeting.id,
        )}`,
      )
      .send(responseBody);
  }
}
