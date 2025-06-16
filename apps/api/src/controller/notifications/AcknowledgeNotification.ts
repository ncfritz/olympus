import {
  AcknowledgeNotificationRequest,
  AcknowledgeNotificationResponse,
} from "@ncfritz/olympus-model/dist/notifications";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiNotModifiedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment, { Moment } from "moment";
import {
  GraphQlNotification,
  toDomainObject,
} from "../../convert/notifications/NotificationConverter";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";
import { NotificationsGateway } from "../../ws/gateway/NotificationsGateway";
import { BaseNotificationsController } from "./BaseNotificationsController";

type GraphQlDescribeNotificationResponse = {
  olympus_notifications: GraphQlNotification[];
};
type GraphQlUpdateNotificationResponse = {
  update_olympus_notifications_by_pk: GraphQlNotification;
};

@Controller()
export class AcknowledgeNotificationController extends BaseNotificationsController {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly notificationsGateway: NotificationsGateway,
  ) {
    super();
  }

  @Put("/v1/notification/:notificationId/acknowledge")
  @ApiOperation({
    summary: "Sets a notification's ACK status",
    description:
      "This API will acknowledge or un-acknowledge a notification, based on the user input.  By default when a " +
      "notification is marked as acknowledged, it will be marked for deletion three days after the acknowledgement " +
      "time.  The expiration time will remain unchanged in the event that a notification is un-acknowledged before " +
      "the deletion sweep occurs.",
    operationId: "AcknowledgeNotification",
    tags: ["Notifications"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "notificationId",
    description: "The ID of the notification to set acknowledgement for",
    type: String,
  })
  @ApiBody({
    type: AcknowledgeNotificationRequest,
    required: true,
    description: "Input for the SendNotification operation",
  })
  @ApiOkResponse({
    description:
      "The notification's acknowledge state has been updated successfully.",
    type: AcknowledgeNotificationResponse,
  })
  @ApiNotModifiedResponse({
    description:
      "The supplied acknowledged state did not require updating the notification",
    type: AcknowledgeNotificationResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("notificationId") notificationId: string,
    @Body() request: AcknowledgeNotificationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const queryRequest = gql`
      query GetNotification($notificationId: uuid!) {
        olympus_notifications(
          where: { notificationId: { _eq: $notificationId } }
        ) {
          acknowledged
          acknowledgedTime
          createdTime
          deletionTime
          eventId
          eventTime
          expirationTime
          group
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
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlDescribeNotificationResponse>(
        queryRequest,
        {
          notificationId: notificationId,
        },
      );

    if (
      queryResponse.olympus_notifications === null ||
      queryResponse.olympus_notifications.length <= 0
    ) {
      response.status(HttpStatus.NOT_FOUND).end();
      return;
    }

    const target = toDomainObject(queryResponse.olympus_notifications[0]);

    if (target.acknowledged === request.acknowledged) {
      response.status(HttpStatus.NOT_MODIFIED).json({
        notification: target,
      });
      return;
    }

    const now = moment.utc();
    let deletionTime: Moment | undefined = undefined;
    let expirationTime: Moment | undefined = undefined;

    if (request.acknowledged) {
      expirationTime = now.add(3, "days");
      deletionTime = expirationTime.add(7, "days");
    } else if (target.deletionTime) {
      expirationTime = target.deletionTime.subtract(7, "days");
    }

    const updateRequest = gql`
      mutation UpdateNotification(
        $eventId: uuid!
        $acknowledged: Boolean!
        $expirationTime: timestamptz!
        $deletionTime: timestamptz
      ) {
        update_olympus_notifications_by_pk(
          pk_columns: { eventId: $eventId }
          _set: {
            acknowledged: $acknowledged
            deletionTime: $deletionTime
            expirationTime: $expirationTime
          }
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
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateNotificationResponse>(
        updateRequest,
        {
          eventId: target.eventId,
          acknowledged: request.acknowledged,
          expirationTime: expirationTime
            ? expirationTime.toISOString()
            : undefined,
          deletionTime: deletionTime ? deletionTime.toISOString() : undefined,
        },
      );

    const notification = toDomainObject(
      updateResponse.update_olympus_notifications_by_pk,
    );

    // Push a WebSocket notification to inform the UX that an update is needed.
    await this.sendRefreshMessage(
      notification,
      this.notificationsGateway,
      this.graphQLClient,
    );

    const responseBody: AcknowledgeNotificationResponse = {
      notification: notification,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
