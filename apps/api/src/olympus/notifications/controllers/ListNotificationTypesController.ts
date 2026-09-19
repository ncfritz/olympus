import {
  NotificationTypeWithProtocols,
  ListNotificationTypesResponse,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlFullNotificationType,
  toFullDomainObject,
} from "../converters/NotificationTypeConverter";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlListNotificationTypesResponse = {
  olympus_notification_type: GraphQlFullNotificationType[];
};

@Controller({ version: "1" })
export class ListNotificationTypesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/notifications/types")
  @ApiOperation({
    summary: "Lists notifications types",
    description:
      "Lists currently supported notification types.  This API returns the full set of notifications supported " +
      "and the supported, and default enabled, notification channels for each.",
    operationId: "ListNotificationsTypes",
    tags: ["Notifications"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: ListNotificationTypesResponse,
    description: "The notification type list has been fetched successfully.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const queryRequest = gql`
      query ListNotificationTypes {
        olympus_notification_type {
          createdTime
          defaultGroup {
            createdTime
            description
            id
            name
          }
          description
          id
          name
          emailDefault
          supportsEmail
          supportsSynoChat
          supportsSynoMail
          supportsWebSocket
          synoChatDefault
          synoMailDefault
          webSocketDefault
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotificationTypesResponse>(
        queryRequest,
      );

    const notificationTypes: NotificationTypeWithProtocols[] = [];

    queryResponse.olympus_notification_type.forEach((entry) => {
      notificationTypes.push(toFullDomainObject(entry));
    });

    const responseBody: ListNotificationTypesResponse = {
      notificationTypes: notificationTypes,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
