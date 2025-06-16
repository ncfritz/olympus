import {
  NotificationTypeWithProtocols,
  ListNotificationTypesResponse,
} from "@ncfritz/olympus-model/dist/notifications";
import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  toFullDomainObject,
} from "../../convert/notifications/NotificationTypeConverter";
import { GraphQlFullNotificationType } from "../../convert/notifications/NotificationTypeConverter";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlListNotificationTypesResponse = {
  olympus_notification_type: GraphQlFullNotificationType[];
};

@Controller()
export class ListNotificationTypesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/notifications/types")
  @ApiOperation({
    summary: "Lists notifications types",
    description: "Lists currently supported notification types.",
    operationId: "ListNotificationsTypes",
    tags: ["Notifications"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The notification type list has been fetched successfully.",
    type: ListNotificationTypesResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("groupId") groupId: string,
    @Query("count") count = 10,
    @Res() response: Response,
  ): Promise<void> {
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
