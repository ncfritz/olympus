import {
  CreateNotificationRequest,
  CreateNotificationResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  ConflictException,
  Controller,
  HttpStatus,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
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

type GraphQlDuplicateNotificationsResponse = {
  olympus_notifications_aggregate: {
    aggregate: { count: number };
  };
};

type GraphQlInsertNotificationResponse = {
  insert_olympus_notifications: {
    returning: GraphQlNotification[];
  };
};

type GraphQlGetDefaultGroupResponse = {
  olympus_notification_type: [{ defaultGroupId: string }];
};

@Controller({ version: "1" })
export class CreateNotificationController extends BaseNotificationsController {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly notificationsGateway: NotificationsGateway,
  ) {
    super();
  }

  @Post("/notifications")
  @ApiOperation({
    summary: "Creates a persistent notification",
    description:
      "This API is used internally to create a notification in the notification store.",
    operationId: "CreateNotification",
    tags: ["Notifications"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateNotificationRequest,
    required: true,
    description: "Input for the CreateNotification operation",
  })
  @ApiCreatedResponse({
    type: CreateNotificationResponse,
    description: "The notification was created successfully.",
  })
  @ApiConflictResponse({
    description:
      "The supplied `notificationId` or `eventId` conflicted with another notification in the notification store",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateNotificationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const duplicateQueryRequest = gql`
      query ListNotifications($notificationId: uuid!, $eventId: uuid!) {
        olympus_notifications_aggregate(
          where: {
            _or: {
              eventId: { _eq: $eventId }
              notificationId: { _eq: $notificationId }
            }
          }
        ) {
          aggregate {
            count
          }
        }
      }
    `;

    const duplicateQueryResponse =
      await this.graphQLClient.request<GraphQlDuplicateNotificationsResponse>(
        duplicateQueryRequest,
        {
          eventId: request.notification.eventId,
          notificationId: request.notification.notificationId,
        },
      );

    if (
      duplicateQueryResponse.olympus_notifications_aggregate.aggregate.count > 0
    ) {
      throw new ConflictException();
    }

    const insertRequest = gql`
      mutation CreateNotification(
        $deletionTime: timestamptz
        $eventId: uuid!
        $eventTime: timestamptz
        $expirationTime: timestamptz
        $group: String
        $level: String!
        $notificationId: uuid!
        $notificationType: String!
        $payload: String
        $ttl: String
      ) {
        insert_olympus_notifications(
          objects: {
            deletionTime: $deletionTime
            eventId: $eventId
            eventTime: $eventTime
            expirationTime: $expirationTime
            group: $group
            level: $level
            notificationId: $notificationId
            notificationTypeId: $notificationType
            payload: $payload
            ttl: $ttl
          }
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

    const now = moment.utc();
    let expirationTime: Moment | undefined = undefined;
    let deletionTime: Moment | undefined = undefined;

    if (request.notification.ttl) {
      const ttlDuration = moment.duration(request.notification.ttl);
      expirationTime = now.add(ttlDuration);
      deletionTime = expirationTime.add(7, "days");
    }

    let group = "general";

    if (
      request.notification.group &&
      request.notification.group.trim() !== ""
    ) {
      // There is no check to ensure that the group is valid in the system.  This could be added at the cost of an
      // additional request to the database.  If the group is invalid, we can still persist the notification, it will
      // just be grouped under the "recent" section until acknowledged, when it will effectively be detached from the
      // UI as there is no group to display it under.
      group = request.notification.group;
    } else {
      const groupQuery = gql`
        query GetDefaultGroupForNotificationType($type: String!) {
          olympus_notification_type(where: { id: { _eq: $type } }) {
            defaultGroupId
          }
        }
      `;

      const groupResponse =
        await this.graphQLClient.request<GraphQlGetDefaultGroupResponse>(
          groupQuery,
          {
            type: request.notification.notificationType,
          },
        );

      if (groupResponse.olympus_notification_type.length > 0) {
        group = groupResponse.olympus_notification_type[0].defaultGroupId;
      }
    }

    const insertResponse =
      await this.graphQLClient.request<GraphQlInsertNotificationResponse>(
        insertRequest,
        {
          deletionTime: deletionTime ? deletionTime.toISOString() : undefined,
          eventId: request.notification.eventId,
          eventTime: now.toISOString(),
          expirationTime: expirationTime
            ? expirationTime.toISOString()
            : undefined,
          group: group,
          level: request.notification.level,
          notificationId: request.notification.notificationId,
          notificationType: request.notification.notificationType,
          payload: Buffer.from(
            JSON.stringify(request.notification.payload),
            "utf-8",
          ).toString("base64"),
          ttl: request.notification.ttl,
        },
      );

    const notification = toDomainObject(
      insertResponse.insert_olympus_notifications.returning[0],
    );

    // Push a WebSocket notification to inform the UX that an update is needed.
    await this.sendRefreshMessage(
      notification,
      this.notificationsGateway,
      this.graphQLClient,
    );

    const responseBody: CreateNotificationResponse = {
      notification: notification,
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
