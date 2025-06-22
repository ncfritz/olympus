import {
  NotificationContext,
  SMTPDestinationEvent,
} from "@ncfritz/olympus-model/dist/notifications";
import * as nodemailer from "nodemailer";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import { Transporter } from "nodemailer";
import {
  DESTINATION_GMAIL_SUFFIX,
  NOTIFICATIONS_EXCHANGE,
  NOTIFICATIONS_PREFIX,
} from "../util/constants";
import { SMTPHandler } from "./smtpHandler";

@Injectable()
export class GoogleMailHandler<
  T extends NotificationContext,
> extends SMTPHandler<T> {
  getChannelName(): string {
    return "email";
  }

  @RabbitSubscribe({
    exchange: `${NOTIFICATIONS_EXCHANGE}`,
    queue: `${NOTIFICATIONS_PREFIX}.${DESTINATION_GMAIL_SUFFIX}`,
    routingKey: `${NOTIFICATIONS_PREFIX}.type.${DESTINATION_GMAIL_SUFFIX}`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: SMTPDestinationEvent<T>, amqpMsg: ConsumeMessage) {
    await this.processNotification(msg);
  }

  getTransport(): Transporter {
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      secure: true,
      auth: {
        user: "ncfritz@ncfritz.net",
        pass: "REDACTED",
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
}
