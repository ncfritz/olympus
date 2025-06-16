import {
  Notification,
  ListNotificationsResponse,
} from "@ncfritz/olympus-model/dist/notifications";
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
  GraphQlNotification,
  toDomainObject,
} from "../../convert/notifications/NotificationConverter";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlDescribeNotificationResponse = {
  olympus_notifications: GraphQlNotification[];
  olympus_notification_statistics: any[];
};

@Controller()
export class ListNotificationsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/notifications")
  @ApiOperation({
    summary: "Lists current notifications and statistics",
    description:
      "Lists the top `N` notifications and provides statistics for all notification groups.  Notifications are " +
      "listed regardless of their group or acknowledged status.  For all notification groups, a entry containing the " +
      "number of unread notifications as well as a breakdown of notification count by status will be provided.",
    operationId: "ListNotifications",
    tags: ["Notifications"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "count",
    description:
      "The number of notifications to fetch for the initial list view",
    type: Number,
    default: 10,
  })
  @ApiOkResponse({
    description: "The notification list has been fetched successfully.",
    type: ListNotificationsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("count") count = 10,
    @Res() response: Response,
  ): Promise<void> {
    const queryRequest = gql`
      query ListNotifications {
        olympus_notifications(
        where: { acknowledged: { _neq: true } }
        order_by: { createdTime: desc }, limit: ${count}) {
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
        olympus_notification_statistics {
          acknowledged
          count
          group
          level
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlDescribeNotificationResponse>(
        queryRequest,
      );

    const notifications: Notification[] = [];
    const statistics: Record<string, any> = {};

    queryResponse.olympus_notification_statistics.forEach((statistic) => {
      if (!(statistic.group in statistics)) {
        statistics[statistic.group] = {
          total: statistic.count,
          unread: 0,
          info: 0,
          success: 0,
          warning: 0,
          error: 0,
        };
      }

      statistics[statistic.group][statistic.level] += statistic.count;

      if (!statistic.acknowledged) {
        statistics[statistic.group].unread += statistic.count;
      }
    });

    queryResponse.olympus_notifications.forEach((entry) => {
      notifications.push(toDomainObject(entry));
    });

    const responseBody: ListNotificationsResponse = {
      recent: notifications,
      statistics: statistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
