import { gql, GraphQLClient } from "graphql-request";
import { Notification } from "@ncfritz/olympus-model";
import { logger } from "../../../utils/logger";
import { NotificationsGateway } from "../../../ws/gateway/NotificationsGateway";

type GraphQlGetUnreadCountResponse = {
  olympus_notifications_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

export abstract class BaseNotificationsController {
  protected async getUnreadNotificationsCount(
    client: GraphQLClient,
  ): Promise<number> {
    // TODO: Filter based on the username
    const queryRequest = gql`
      query GetUnreadCount {
        olympus_notifications_aggregate(
          where: { acknowledged: { _neq: true } }
        ) {
          aggregate {
            count
          }
        }
      }
    `;

    const queryResponse =
      await client.request<GraphQlGetUnreadCountResponse>(queryRequest);

    return queryResponse.olympus_notifications_aggregate.aggregate.count;
  }

  protected async sendRefreshMessage(
    notification: Notification,
    gateway: NotificationsGateway,
    client: GraphQLClient,
  ): Promise<void> {
    try {
      gateway.send("notification.refresh", {
        groupId: notification.notificationGroup?.id,
        unreadCount: await this.getUnreadNotificationsCount(client),
      });
    } catch (e) {
      logger.warn(
        `Unable to send WS notification for notificationId ${notification.notificationId} delete operation`,
        e,
      );
    }
  }
}
