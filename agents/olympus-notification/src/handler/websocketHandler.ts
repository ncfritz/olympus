import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  CreateNotificationRequest,
  NotificationContext,
  NotificationPayload,
} from "@ncfritz/olympus-sdk/olympus";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type ConsumeMessage } from "amqplib";
import axios from "axios";
import moment from "moment";
import { io } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { BatchJobCompleteWebsocketFormatter } from "../formatter/external/dionysusNotificationFormatter";
import { NotificationFormatter } from "../formatter/formatter";
import { WebSocketStaticStringFormatter } from "../formatter/staticStringFormatter";
import { type WebSocketDestinationEvent } from "../types/destinations";
import { WebSocketPayload } from "../types/payloads";
import {
  DESTINATION_WEBSOCKET_SUFFIX,
  NOTIFICATIONS_EXCHANGE,
  NOTIFICATIONS_PREFIX,
} from "../util/constants";
import { logger } from "../util/logger";
import { BaseHandler } from "./baseHandler";

@Injectable()
export class WebSocketHandler extends BaseHandler<
  WebSocketDestinationEvent<any>,
  WebSocketPayload
> {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  getChannelName(): string {
    return "WebSocket";
  }

  @RabbitSubscribe({
    exchange: `${NOTIFICATIONS_EXCHANGE}`,
    queue: `${NOTIFICATIONS_PREFIX}.${DESTINATION_WEBSOCKET_SUFFIX}`,
    routingKey: `${NOTIFICATIONS_PREFIX}.type.${DESTINATION_WEBSOCKET_SUFFIX}`,
  })
  public async handle(
    msg: WebSocketDestinationEvent<NotificationContext>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    amqpMsg: ConsumeMessage,
  ) {
    await this.processNotification(msg);
  }

  async transact(
    msg: WebSocketDestinationEvent<NotificationContext>,
    payload: WebSocketPayload,
  ): Promise<void> {
    try {
      const eventId = uuidv4();
      const wsHost = this.configService.get<string>(
        "WSS_HOST",
        "ws://localhost:3000",
      );
      const apiHost = this.configService.get<string>(
        "API_HOST",
        "http:localhost:3001",
      );

      const event = {
        eventId: eventId,
        notificationId: msg.notificationId,
        eventTime: moment().utc().toISOString(),
        messageType: msg.notificationType,
        level: msg.level || "info",
        durable: msg.durable,
        closable: msg.closable,
        deleteOnClose: msg.durable && msg.deleteOnClose,
        visibleDuration: msg.visibleDuration,
        ghost: msg.ghost,
        payload: payload,
      };

      logger.info(`Publishing event to ${wsHost}...`);

      const socket = io(`${wsHost}/notifications`);
      socket.emit("notification.proxy_to_frontend", event);

      // Attempt to persist the notification to the notification store.
      if (msg.durable) {
        const createNotificationRequest: CreateNotificationRequest = {
          notification: {
            acknowledged: false,
            notificationId: msg.notificationId,
            notificationType: msg.notificationType,
            level: msg.level,
            payload: payload as unknown as NotificationPayload,
            eventId: msg.eventId,
            group: msg.group,
            ttl: msg.ttl,
          },
        };

        await axios.post(
          `${apiHost}/v1/notifications`,
          createNotificationRequest,
        );
      }
    } catch (e) {
      logger.error(`Unable to send WS notification`, e);
    }
  }

  getFormatterForType(
    type: string,
  ):
    | NotificationFormatter<
        WebSocketDestinationEvent<NotificationContext>,
        WebSocketPayload
      >
    | undefined {
    switch (type) {
      case "system_test":
        return new WebSocketStaticStringFormatter(
          "Test",
          "This is a test message",
        );
      case "dionysus_batch_job_complete":
        return new BatchJobCompleteWebsocketFormatter();
      default:
        return undefined;
    }
  }
}
