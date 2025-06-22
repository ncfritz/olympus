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
  DESTINATION_SYNOMAIL_SUFFIX,
  NOTIFICATIONS_EXCHANGE,
  NOTIFICATIONS_PREFIX,
} from "../util/constants";
import { SMTPHandler } from "./smtpHandler";

@Injectable()
export class SynologyEmailHandler<
  T extends NotificationContext,
> extends SMTPHandler<T> {
  getChannelName(): string {
    return "SynoEmail";
  }

  @RabbitSubscribe({
    exchange: `${NOTIFICATIONS_EXCHANGE}`,
    queue: `${NOTIFICATIONS_PREFIX}.${DESTINATION_SYNOMAIL_SUFFIX}`,
    routingKey: `${NOTIFICATIONS_PREFIX}.type.${DESTINATION_SYNOMAIL_SUFFIX}`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: SMTPDestinationEvent<T>, amqpMsg: ConsumeMessage) {
    await this.processNotification(msg);
  }

  getTransport(): Transporter {
    return nodemailer.createTransport({
      host: "192.168.15.38",
      secure: true,
      auth: {
        user: "ncfritz",
        pass: "REDACTED",
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
}
