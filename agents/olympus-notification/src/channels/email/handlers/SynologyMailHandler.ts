import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { Inject, Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { synologyMailConfig } from "../../../config/configuration";
import type { SynologyMailConfigType } from "../../../config/configuration";
import type { SmtpNotificationEvent } from "../../../delivery/events";
import {
  channelQueue,
  NotificationChannel,
  notificationRoutingKey,
  NOTIFICATIONS_EXCHANGE,
} from "../../../messaging";
import { EmailFormatters } from "../formatters/EmailFormatters";
import { SmtpHandler } from "./SmtpHandler";

/** Internal email through the Synology mail server (queue notifications.synomail). */
@Injectable()
export class SynologyMailHandler extends SmtpHandler {
  constructor(
    formatters: EmailFormatters,
    @Inject(synologyMailConfig.KEY)
    private readonly synologyMail: SynologyMailConfigType,
  ) {
    super(formatters);
  }

  get channelName(): string {
    return "SynoEmail";
  }

  @RabbitSubscribe({
    exchange: NOTIFICATIONS_EXCHANGE,
    queue: channelQueue(NotificationChannel.SYNOMAIL),
    routingKey: notificationRoutingKey(NotificationChannel.SYNOMAIL),
  })
  async handle(
    notification: SmtpNotificationEvent<NotificationContext>,
  ): Promise<void> {
    await this.deliver(notification);
  }

  protected transport(): Transporter {
    return nodemailer.createTransport({
      host: this.synologyMail.host,
      secure: true,
      auth: { user: this.synologyMail.user, pass: this.synologyMail.password },
      tls: { rejectUnauthorized: false },
    });
  }
}
