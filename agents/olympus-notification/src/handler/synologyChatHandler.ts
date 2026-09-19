import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type ConsumeMessage } from "amqplib";
import axios from "axios";
import { NotificationFormatter } from "../formatter/formatter";
import { SynoChatStaticStringFormatter } from "../formatter/synoChatFormatter";
import { type SynoChatDestinationEvent } from "../types/destinations";
import { SynoChatPayload } from "../types/payloads";
import {
  DESTINATION_SYNOCHAT_SUFFIX,
  NOTIFICATIONS_EXCHANGE,
  NOTIFICATIONS_PREFIX,
} from "../util/constants";
import { logger } from "../util/logger";
import { BaseHandler } from "./baseHandler";

type SynoChatEndpoints = {
  bot: Record<string, string>;
  channel: Record<string, string>;
};

const SYNO_CHAT_API = "webapi/entry.cgi?api=SYNO.Chat.External&version=2";

@Injectable()
export class SynologyChatHandler<
  T extends NotificationContext,
> extends BaseHandler<SynoChatDestinationEvent<T>, SynoChatPayload> {
  private readonly endpoints: SynoChatEndpoints;

  /**
   * Webhook URLs by destination name. Tokens come from the environment
   * (SYNO_CHAT_OLYMPUS_BOT_TOKEN, SYNO_CHAT_OLYMPUS_CHANNEL_TOKEN); a
   * destination without a token is treated as unknown.
   */
  constructor(configService: ConfigService) {
    super();
    const host = configService.get<string>(
      "SYNO_CHAT_HOST",
      "https://nfs02.sea.ncfritz.net",
    );
    const url = (
      method: string,
      token: string | undefined,
    ): Record<string, string> =>
      token
        ? {
            olympus: `${host}/${SYNO_CHAT_API}&method=${method}&token=%22${token}%22`,
          }
        : {};
    this.endpoints = {
      bot: url(
        "chatbot",
        configService.get<string>("SYNO_CHAT_OLYMPUS_BOT_TOKEN"),
      ),
      channel: url(
        "incoming",
        configService.get<string>("SYNO_CHAT_OLYMPUS_CHANNEL_TOKEN"),
      ),
    };
  }

  getChannelName(): string {
    return "SynoChat";
  }

  @RabbitSubscribe({
    exchange: `${NOTIFICATIONS_EXCHANGE}`,
    queue: `${NOTIFICATIONS_PREFIX}.${DESTINATION_SYNOCHAT_SUFFIX}`,
    routingKey: `${NOTIFICATIONS_PREFIX}.type.${DESTINATION_SYNOCHAT_SUFFIX}`,
  })
  public async handle(
    msg: SynoChatDestinationEvent<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    amqpMsg: ConsumeMessage,
  ) {
    await this.processNotification(msg);
  }

  async transact(
    msg: SynoChatDestinationEvent<T>,
    payload: SynoChatPayload,
  ): Promise<void> {
    const data = { ...payload };
    let endpoint: string;

    if (msg.destinationType === "bot") {
      data.user_ids = msg.users;

      if (!Object.keys(this.endpoints.bot).includes(msg.destination)) {
        logger.info(`Bot '${msg.destination}' not found, nothing to do.`);
        return;
      } else {
        endpoint = this.endpoints.bot[msg.destination];
      }
    } else {
      if (!Object.keys(this.endpoints.channel).includes(msg.destination)) {
        logger.info(`Channel '${msg.destination}' not found, nothing to do.`);
        return;
      } else {
        endpoint = this.endpoints.channel[msg.destination];
      }
    }

    logger.debug(`payload=${JSON.stringify(data)}"}`);

    const response = await axios.post(
      endpoint,
      `payload=${JSON.stringify(data)}"}`,
      {
        headers: {
          "Content-Type": "text/plain",
        },
      },
    );

    logger.debug(
      `Got response from SynologyChat: ${JSON.stringify(response.data)}`,
    );
  }

  getFormatterForType(
    type: string,
  ):
    | NotificationFormatter<SynoChatDestinationEvent<T>, SynoChatPayload>
    | undefined {
    switch (type) {
      case "system_test":
        return new SynoChatStaticStringFormatter("This is a test message");
      default:
        return undefined;
    }
  }
}
