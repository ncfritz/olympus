import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { Inject, Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { gmailConfig } from "../../../config/configuration";
import type { GmailConfigType } from "../../../config/configuration";
import type { SmtpNotificationEvent } from "../../../delivery/events";
import {
  channelQueue,
  NotificationChannel,
  notificationRoutingKey,
  NOTIFICATIONS_EXCHANGE,
} from "../../../messaging";
import { EmailFormatters } from "../formatters/EmailFormatters";
import { SmtpHandler } from "./SmtpHandler";

/** External email through Gmail (queue notifications.email). */
@Injectable()
export class GmailHandler extends SmtpHandler {
  constructor(
    formatters: EmailFormatters,
    @Inject(gmailConfig.KEY) private readonly gmail: GmailConfigType,
  ) {
    super(formatters);
  }

  get channelName(): string {
    return "email";
  }

  @RabbitSubscribe({
    exchange: NOTIFICATIONS_EXCHANGE,
    queue: channelQueue(NotificationChannel.EMAIL),
    routingKey: notificationRoutingKey(NotificationChannel.EMAIL),
  })
  async handle(
    notification: SmtpNotificationEvent<NotificationContext>,
  ): Promise<void> {
    await this.deliver(notification);
  }

  protected transport(): Transporter {
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      secure: true,
      auth: { user: this.gmail.user, pass: this.gmail.appPassword },
      tls: { rejectUnauthorized: false },
    });
  }
}
