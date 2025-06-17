import { SortDirection } from "@ncfritz/olympus-model";
import {
  Notification,
  ListNotificationsInGroupResponse,
} from "@ncfritz/olympus-model/dist/notifications";
import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlNotification,
  toDomainObject,
} from "../../convert/notifications/NotificationConverter";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../utils/controllerDecorators";

type GraphQlListNotificationsInGroupResponse = {
  olympus_notifications: GraphQlNotification[];
  olympus_notifications_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller()
export class ListNotificationInGroupController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/notifications/group/:groupId/notifications")
  @ApiOperation({
    summary: "Lists current notifications and statistics",
    description:
      "Lists the top `N` notifications and provides statistics for a specific notification group.  Notifications are " +
      "listed regardless of their acknowledged status.",
    operationId: "ListNotificationsInGroup",
    tags: ["Notifications"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "groupId",
    description: "The ID of the group to list notifications for.",
    type: String,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    description: "The notification list has been fetched successfully.",
    type: ListNotificationsInGroupResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("groupId") groupId: string,
    @Query("pageSize") pageSize = 10,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const queryRequest = gql`
      query ListNotificationsInGroup($group: String!) {
        olympus_notifications(
          limit: ${pageSize}
          offset: ${pageSize * startPage}
          order_by: {${sortField}: ${sortDirection}}
          where: { group: { _eq: $group } }
        ) {
          acknowledged
          acknowledgedTime
          createdTime
          deletionTime
          eventId
          eventTime
          expirationTime
          level
          notificationId
          payload
          ttl
          notificationGroup {
            createdTime
            description
            id
            name
          }
          notificationType {
            createdTime
            defaultGroupId
            id
            description
            name
          }
        }
        olympus_notifications_aggregate(where: {group: {_eq: $group}}) {
          aggregate {
            count
          }
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotificationsInGroupResponse>(
        queryRequest,
        { group: groupId },
      );

    const notifications: Notification[] = [];

    queryResponse.olympus_notifications.forEach((entry) => {
      notifications.push(toDomainObject(entry));
    });

    const responseBody: ListNotificationsInGroupResponse = {
      notifications: notifications,
      count: queryResponse.olympus_notifications_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
