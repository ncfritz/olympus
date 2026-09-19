import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  CreateNotificationRequest,
  NotificationContext,
  NotificationPayload,
} from "@ncfritz/olympus-sdk/olympus";
import { Inject, Injectable } from "@nestjs/common";
import axios from "axios";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import { olympusConfig } from "../../../config/configuration";
import type { OlympusConfigType } from "../../../config/configuration";
import { DeliveryHandler } from "../../../delivery/DeliveryHandler";
import type { WebSocketNotificationEvent } from "../../../delivery/events";
import {
  channelQueue,
  NotificationChannel,
  notificationRoutingKey,
  NOTIFICATIONS_EXCHANGE,
} from "../../../messaging";
import { WebSocketFormatters } from "../formatters/WebSocketFormatters";
import type { WebSocketPayload } from "../payload";
import { WebSocketPublisher } from "../services/WebSocketPublisher";

type WebSocketEvent = WebSocketNotificationEvent<NotificationContext>;

/**
 * Relays notifications to open browsers; durable ones are also stored as
 * notifications in the API.
 */
@Injectable()
export class WebSocketHandler extends DeliveryHandler<
  WebSocketEvent,
  WebSocketPayload
> {
  constructor(
    private readonly formatters: WebSocketFormatters,
    private readonly publisher: WebSocketPublisher,
    @Inject(olympusConfig.KEY) private readonly olympus: OlympusConfigType,
  ) {
    super();
  }

  get channelName(): string {
    return "WebSocket";
  }

  @RabbitSubscribe({
    exchange: NOTIFICATIONS_EXCHANGE,
    queue: channelQueue(NotificationChannel.WEBSOCKET),
    routingKey: notificationRoutingKey(NotificationChannel.WEBSOCKET),
  })
  async handle(notification: WebSocketEvent): Promise<void> {
    await this.deliver(notification);
  }

  protected formatterFor(notificationType: string) {
    return this.formatters.formatterFor(notificationType);
  }

  protected async send(
    msg: WebSocketEvent,
    payload: WebSocketPayload,
  ): Promise<void> {
    try {
      this.publisher.publish({
        eventId: uuidv4(),
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
      });

      // Attempt to persist the notification to the notification store.
      if (msg.durable) {
        const createNotificationRequest: CreateNotificationRequest = {
          notification: {
            acknowledged: false,
            notificationId: msg.notificationId,
            notificationType: msg.notificationType,
            level: msg.level ?? "info",
            payload: payload as unknown as NotificationPayload,
            eventId: msg.eventId,
            group: msg.group,
            ttl: msg.ttl,
          },
        };

        await axios.post(
          `${this.olympus.apiHost}/v1/notifications`,
          createNotificationRequest,
        );
      }
    } catch (e) {
      this.logger.error(
        "Unable to send WS notification",
        e instanceof Error ? e.stack : String(e),
      );
    }
  }
}
