import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";
import { type SMTPDestinationEvent } from "../types/destinations";
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
        user: this.configService.get<string>(
          "GMAIL_USER",
          "ncfritz@ncfritz.net",
        ),
        pass: this.configService.get<string>("GMAIL_APP_PASSWORD"),
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
}
