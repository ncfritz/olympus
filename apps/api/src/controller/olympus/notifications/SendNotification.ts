import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  DeliveryState,
  DeliveryStatus,
  EmailValueField,
  SendNotificationRequest,
  SendNotificationResponse,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { logger } from "../../../utils/logger";

type GraphQlNotificationSetting = {
  olympus_notification_settings_by_pk: {
    synoChat: boolean;
    synoMail: boolean;
    webSocket: boolean;
    email: boolean;
  };
  olympus_notification_type_by_pk: {
    supportsEmail: boolean;
    supportsSynoChat: boolean;
    supportsSynoMail: boolean;
    supportsWebSocket: boolean;
    synoChatDefault: boolean;
    synoMailDefault: boolean;
    webSocketDefault: boolean;
    emailDefault: boolean;
  };
};

type NotificationHint = {
  webSocket: boolean;
  synoChat: boolean;
  synoMail: boolean;
  email: boolean;
};

const NOTIFICATION_TRIGGER_EXCHANGE = "notifications.trigger";

@Controller({ version: "1" })
export class SendNotificationController {
  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly graphQLClient: GraphQLClient,
  ) {}

  @Post("/notifications/publish")
  @ApiOperation({
    summary: "Sends a notification to one or more destinations",
    description:
      "This API employs an optimistic send strategy and will fail open.  Internally, each destination may retry one " +
      "or more times on failure, but any notification destination that reports a permanent failure will NOT be " +
      "retried after the API returns." +
      "" +
      "Notifications sent to the WebSocket destination CAN be persisted for in-app retrieval after initial " +
      "notification.  There are various mechanisms to control the in-app display and notification lifetime.  It " +
      "is recommended that a notification's TTL be set to a reasonable value where applicable." +
      "" +
      "This API will report success or failure for each destination provided in the request.  This does not indicate " +
      "delivery of the notification to the final provider, only whether the notification was successfully enqueued " +
      "for further processing.",
    operationId: "SendNotification",
    tags: ["Notifications"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: SendNotificationRequest,
    required: true,
    description: "Input for the SendNotification operation",
  })
  @ApiAcceptedResponse({
    type: SendNotificationResponse,
    description:
      "The notification was successfully enqueued to all destinations.",
  })
  @ApiResponse({
    type: SendNotificationResponse,
    status: 207,
    description: "Enqueuing with some or all notification destinations failed.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: SendNotificationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const notificationId = uuidv4();
    const responseBody: SendNotificationResponse = {
      notificationId: notificationId,
    };

    if (request.expirationTime) {
      const expirationTime = moment(request.expirationTime);

      if (moment.utc().isAfter(expirationTime)) {
        response.status(HttpStatus.BAD_REQUEST).send(responseBody);
        return;
      }
    }

    // TODO: Plumb in username when it is available
    const settings = await this.loadNotificationSetting(
      "ncfritz",
      request.type,
    );

    if (!settings) {
      throw new BadRequestException();
    }

    const enqueueTasks: Promise<void>[] = [];

    if (request.webSocketDestination) {
      if (settings.webSocket) {
        enqueueTasks.push(
          this.enqueueWebSocketNotification(
            request,
            notificationId,
            responseBody,
          ),
        );
      } else {
        logger.info(
          `Notification type "${notificationId}" does not support the WebSocket channel or the user has disabled the WebSocket channel for this notification type.`,
        );
      }
    }

    if (request.synoChatDestination) {
      if (settings.synoChat) {
        enqueueTasks.push(
          this.enqueueSynoChatNNotification(
            request,
            notificationId,
            responseBody,
          ),
        );
      } else {
        logger.info(
          `Notification type "${notificationId}" does not support the SynoChat channel or the user has disabled the SynoChat channel for this notification type.`,
        );
      }
    }

    if (request.synoMailDestination) {
      if (settings.synoMail) {
        enqueueTasks.push(
          this.enqueueMailNotification(
            "synomail",
            request,
            notificationId,
            responseBody,
          ),
        );
      } else {
        logger.info(
          `Notification type "${notificationId}" does not support the SynoMail channel or the user has disabled the SynoMail channel for this notification type.`,
        );
      }
    }

    if (request.smtpDestination) {
      if (settings.email) {
        enqueueTasks.push(
          this.enqueueMailNotification(
            "email",
            request,
            notificationId,
            responseBody,
          ),
        );
      } else {
        logger.info(
          `Notification type "${notificationId}" does not support the Email channel or the user has disabled the Email channel for this notification type.`,
        );
      }
    }

    await Promise.allSettled(enqueueTasks);

    response.status(HttpStatus.ACCEPTED).send(responseBody);
  }

  private async enqueueWebSocketNotification(
    request: SendNotificationRequest,
    notificationId: string,
    responseBody: SendNotificationResponse,
  ): Promise<void> {
    console.log("Publishing WS");
    if (!request.webSocketDestination) {
      return;
    }

    const eventId = uuidv4();
    const now = moment.utc();
    const deliveryStatus: DeliveryStatus = {
      eventId: eventId,
      status: DeliveryState.UNKNOWN,
    };

    try {
      await this.amqpConnection.publish(
        NOTIFICATION_TRIGGER_EXCHANGE,
        "notifications.type.ws",
        {
          eventId: eventId,
          notificationId: notificationId,
          notificationType: request.type,
          expirationTime: request.expirationTime,
          publishTime: now.toISOString(),
          level: request.webSocketDestination.level,
          durable: request.webSocketDestination.durable,
          closable: request.webSocketDestination.closable,
          deleteOnClose: request.webSocketDestination.deleteOnClose,
          visibleDuration: request.webSocketDestination.visibleDuration,
          ghost: request.webSocketDestination.ghost,
          group: request.webSocketDestination.group,
          context: request.context,
        },
      );

      deliveryStatus.status = DeliveryState.SUCCESS;
    } catch (e) {
      deliveryStatus.status = DeliveryState.FAILURE;

      logger.error(
        `Failed to enqueue notification ${notificationId} with AMQP exchange ${NOTIFICATION_TRIGGER_EXCHANGE}`,
        e,
      );
    } finally {
      responseBody.webSocketDestination = deliveryStatus;
    }
  }

  private async enqueueSynoChatNNotification(
    request: SendNotificationRequest,
    notificationId: string,
    responseBody: SendNotificationResponse,
  ): Promise<void> {
    if (!request.synoChatDestination) {
      return;
    }

    const eventId = uuidv4();
    const deliveryStatus: DeliveryStatus = {
      eventId: eventId,
      status: DeliveryState.UNKNOWN,
    };

    try {
      await this.amqpConnection.publish(
        "notifications.trigger",
        "notifications.type.synochat",
        {
          eventId: uuidv4(),
          notificationId: notificationId,
          notificationType: request.type,
          expirationTime: request.expirationTime,
          deliveryType: request.synoChatDestination.destinationType,
          destination: request.synoChatDestination.destination,
          users: request.synoChatDestination.users,
          context: request.context,
        },
      );

      deliveryStatus.status = DeliveryState.SUCCESS;
    } catch (e) {
      deliveryStatus.status = DeliveryState.FAILURE;

      logger.error(
        `Failed to enqueue notification ${notificationId} with AMQP exchange ${NOTIFICATION_TRIGGER_EXCHANGE}`,
        e,
      );
    } finally {
      responseBody.synoChatDestination = deliveryStatus;
    }
  }

  private async enqueueMailNotification(
    mailType: "synomail" | "email",
    request: SendNotificationRequest,
    notificationId: string,
    responseBody: SendNotificationResponse,
  ): Promise<void> {
    const smtpDestination =
      mailType === "synomail"
        ? request.synoMailDestination
        : request.smtpDestination;

    if (!smtpDestination) {
      return;
    }

    const eventId = uuidv4();
    const deliveryStatus: DeliveryStatus = {
      eventId: eventId,
      status: DeliveryState.UNKNOWN,
    };

    try {
      await this.amqpConnection.publish(
        "notifications.trigger",
        `notifications.type.${mailType}`,
        {
          eventId: uuidv4(),
          notificationId: notificationId,
          notificationType: request.type,
          expirationTime: request.expirationTime,
          priority: smtpDestination.priority,
          from: smtpDestination.from,
          to: smtpDestination.to.map((item) => (item as EmailValueField).value),
          cc: smtpDestination.cc?.map(
            (item) => (item as EmailValueField).value,
          ),
          bcc: smtpDestination.bcc?.map(
            (item) => (item as EmailValueField).value,
          ),
          context: request.context,
        },
      );

      deliveryStatus.status = DeliveryState.SUCCESS;
    } catch (e) {
      deliveryStatus.status = DeliveryState.FAILURE;

      logger.error(
        `Failed to enqueue notification ${notificationId} with AMQP exchange ${NOTIFICATION_TRIGGER_EXCHANGE}`,
        e,
      );
    } finally {
      if (mailType === "synomail") {
        responseBody.synoMailDestination = deliveryStatus;
      } else {
        responseBody.externalMailDestination = deliveryStatus;
      }
    }
  }

  private async loadNotificationSetting(
    username: string,
    notificationType: string,
  ): Promise<NotificationHint | undefined> {
    const queryRequest = gql`
      query GetNotificationSetting(
        $username: String!
        $notificationTypeId: String!
      ) {
        olympus_notification_settings_by_pk(
          notificationTypeId: $notificationTypeId
          username: $username
        ) {
          synoChat
          synoMail
          email
          webSocket
        }
        olympus_notification_type_by_pk(id: $notificationTypeId) {
          supportsEmail
          supportsSynoChat
          supportsSynoMail
          supportsWebSocket
          synoChatDefault
          synoMailDefault
          webSocketDefault
          emailDefault
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlNotificationSetting>(
        queryRequest,
        {
          username: username,
          notificationTypeId: notificationType,
        },
      );

    if (!queryResponse.olympus_notification_type_by_pk) {
      return undefined;
    }

    return {
      webSocket:
        queryResponse.olympus_notification_type_by_pk.supportsWebSocket &&
        (queryResponse.olympus_notification_settings_by_pk
          ? queryResponse.olympus_notification_settings_by_pk.webSocket
          : queryResponse.olympus_notification_type_by_pk.webSocketDefault),
      synoChat:
        queryResponse.olympus_notification_type_by_pk.supportsSynoChat &&
        (queryResponse.olympus_notification_settings_by_pk
          ? queryResponse.olympus_notification_settings_by_pk.synoChat
          : queryResponse.olympus_notification_type_by_pk.synoChatDefault),
      synoMail:
        queryResponse.olympus_notification_type_by_pk.supportsSynoMail &&
        (queryResponse.olympus_notification_settings_by_pk
          ? queryResponse.olympus_notification_settings_by_pk.synoMail
          : queryResponse.olympus_notification_type_by_pk.synoMailDefault),
      email:
        queryResponse.olympus_notification_type_by_pk.supportsEmail &&
        (queryResponse.olympus_notification_settings_by_pk
          ? queryResponse.olympus_notification_settings_by_pk.email
          : queryResponse.olympus_notification_type_by_pk.emailDefault),
    };
  }
}
