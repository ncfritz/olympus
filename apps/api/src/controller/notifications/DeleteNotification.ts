import { DeleteNotificationResponse } from "@ncfritz/olympus-model/dist/notifications";
import { Controller, Delete, HttpStatus, NotFoundException, Param, Res } from "@nestjs/common";
import {
  ApiNoContentResponse,
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
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";
import { NotificationsGateway } from "../../ws/gateway/NotificationsGateway";
import { BaseNotificationsController } from "./BaseNotificationsController";

type GraphQlDeleteNotificationResponse = {
  delete_olympus_notifications: {
    returning: GraphQlNotification[];
  };
};

@Controller()
export class DeleteNotificationController extends BaseNotificationsController {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly notificationsGateway: NotificationsGateway,
  ) {
    super();
  }

  @Delete("/v1/notification/:notificationId")
  @ApiOperation({
    summary: "Deletes a notification",
    description:
      "This API hard deletes a notification.  This action will directly remove the notification from the notification" +
      "store and is a non-recoverable operation.  If you need to soft delete a notification, it is recommended to " +
      "use the `AcknowledgeNotification` API with a `ttl` value of `0`.",
    operationId: "DeleteNotification",
    tags: ["Notifications"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "notificationId",
    description: "The ID of the notification to delete",
    type: String,
  })
  @ApiNoContentResponse({
    description: "The notification has been successfully deleted.",
    type: DeleteNotificationResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("notificationId") notificationId: string,
    @Res() response: Response,
  ): Promise<void> {
    const deleteRequest = gql`
      mutation DeleteNotification($notificationId: uuid!) {
        delete_olympus_notifications(
          where: { notificationId: { _eq: $notificationId } }
        ) {
          returning {
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
        }
      }
    `;

    const deleteResponse =
      await this.graphQLClient.request<GraphQlDeleteNotificationResponse>(
        deleteRequest,
        {
          notificationId: notificationId,
        },
      );

    if (deleteResponse.delete_olympus_notifications.returning.length <= 0) {
      throw new NotFoundException();
    }

    const notification = toDomainObject(
      deleteResponse.delete_olympus_notifications.returning[0],
    );

    // Push a WebSocket notification to inform the UX that an update is needed.
    await this.sendRefreshMessage(
      notification,
      this.notificationsGateway,
      this.graphQLClient,
    );

    const responseBody: DeleteNotificationResponse = {
      notification: notification,
    };

    response.status(HttpStatus.NO_CONTENT).send(responseBody);
  }
}
