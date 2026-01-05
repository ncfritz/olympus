import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type ConsumeMessage } from "amqplib";
import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";
import { type SMTPDestinationEvent } from "../types/destinations";
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
  constructor(protected readonly configService: ConfigService) {
    super(configService);
  }

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
      host: this.configService.get<string>("SYNO_SMTP_HOST", "192.168.15.21"),
      secure: true,
      auth: {
        user: this.configService.get<string>("SYNO_SMTP_USER", "ncfritz"),
        pass: this.configService.get<string>("SYNO_SMTP_PASSWORD"),
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
}
