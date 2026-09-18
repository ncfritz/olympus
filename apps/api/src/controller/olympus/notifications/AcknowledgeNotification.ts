import {
  AcknowledgeNotificationRequest,
  AcknowledgeNotificationResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiNotModifiedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment, { Moment } from "moment";
import {
  GraphQlNotification,
  toDomainObject,
} from "../../../convert/olympus/notifications/NotificationConverter";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NotificationsGateway } from "../../../ws/gateway/NotificationsGateway";
import { BaseNotificationsController } from "./BaseNotificationsController";

type GraphQlDescribeNotificationResponse = {
  olympus_notifications: GraphQlNotification[];
};
type GraphQlUpdateNotificationResponse = {
  update_olympus_notifications_by_pk: GraphQlNotification;
};

@Controller({ version: "1" })
export class AcknowledgeNotificationController extends BaseNotificationsController {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly notificationsGateway: NotificationsGateway,
  ) {
    super();
  }

  @Put("/notification/:notificationId/acknowledge")
  @ApiOperation({
    summary: "Sets a notification's ACK status",
    description:
      "This API will acknowledge or un-acknowledge a notification, based on the user input.  By default when a " +
      "notification is marked as acknowledged, it expires after the requested `ttl` (three days by " +
      "default) and is marked for deletion seven days after that.  The expiration time will remain unchanged in the event that a notification is un-acknowledged before " +
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
    type: AcknowledgeNotificationResponse,
    description:
      "The notification's acknowledge state has been updated successfully.",
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
      throw new NotFoundException();
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
    let expirationTime: Moment | undefined;

    // If the notification is being acknowledged, set the expiration according to the TTL.  The final deletion time
    // is system enforced at seven days.  If the notification is being un-acknowledged, use the stamped deletionTime
    // to back off the seven-day soft deletion period.
    if (request.acknowledged) {
      expirationTime = now.clone().add(moment.duration(request.ttl ?? "P3D"));
      deletionTime = expirationTime.clone().add(7, "days");
    } else if (target.deletionTime) {
      expirationTime = target.deletionTime.clone().subtract(7, "days");
    } else {
      expirationTime = target.expirationTime;
    }

    const updateRequest = gql`
      mutation UpdateNotification(
        $eventId: uuid!
        $acknowledged: Boolean!
        $expirationTime: timestamptz
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
