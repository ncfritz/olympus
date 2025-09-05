import {
  ListNotificationGroupsResponse,
  NotificationGroup,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlNotificationGroup,
  toDomainObject,
} from "../../../convert/olympus/notifications/NotificationGroupConverter";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlListNotificationGroupsResponse = {
  olympus_notification_groups: GraphQlNotificationGroup[];
};

@Controller({ version: "1" })
export class ListNotificationGroupsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/notifications/groups")
  @ApiOperation({
    summary: "Lists current notification groups",
    description:
      "Lists all available notification groups.  This API does not enumerate or provide any information about the " +
      "number of notifications or notification status for the groups.",
    operationId: "ListNotificationGroups",
    tags: ["Notifications"],
  })
  @ApiQuery({
    name: "includeNotificationTypes",
    description:
      "When `true`, supported notification types information will be included with each group",
    type: Boolean,
    default: false,
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: ListNotificationGroupsResponse,
    description: "The notification group list has been fetched successfully.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("includeNotificationTypes")
    includeNotificationTypes: boolean = false,
    @Res() response: Response,
  ): Promise<void> {
    const typesClause = includeNotificationTypes
      ? `notificationTypes {
      createdTime
      description
      id
      name
      supportsEmail
      supportsSynoChat
      supportsSynoMail
      supportsWebSocket
    }`
      : "";

    const queryRequest = gql`
      query ListNotificationGroups {
        olympus_notification_groups {
          createdTime
          description
          id
          name
          ${typesClause}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotificationGroupsResponse>(
        queryRequest,
      );

    const notificationGroups: NotificationGroup[] = [];

    queryResponse.olympus_notification_groups.forEach((entry) => {
      notificationGroups.push(toDomainObject(entry));
    });

    const responseBody: ListNotificationGroupsResponse = {
      groups: notificationGroups,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
