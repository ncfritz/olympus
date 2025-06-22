import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  NotificationContext,
  SynoChatDestinationEvent,
  SynoChatDestinationType,
  SynoChatPayload,
} from "@ncfritz/olympus-model/dist/notifications";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import axios from "axios";
import { NotificationFormatter } from "../formatter/formatter";
import { SynoChatStaticStringFormatter } from "../formatter/synoChatFormatter";
import {
  DESTINATION_SYNOCHAT_SUFFIX,
  NOTIFICATIONS_EXCHANGE,
  NOTIFICATIONS_PREFIX,
} from "../util/constants";
import { logger } from "../util/logger";
import { BaseHandler } from "./baseHandler";

const SYNO_ENDPOINTS: {
  bot: { [key: string]: string };
  channel: { [key: string]: string };
} = {
  bot: {
    olympus:
      "https://nfs02.sea.ncfritz.net/webapi/entry.cgi?api=SYNO.Chat.External&method=chatbot&version=2&token=%22REDACTED%22",
  },
  channel: {
    olympus:
      "https://nfs02.sea.ncfritz.net/webapi/entry.cgi?api=SYNO.Chat.External&method=incoming&version=2&token=%22REDACTED%22",
  },
};

@Injectable()
export class SynologyChatHandler<
  T extends NotificationContext,
> extends BaseHandler<SynoChatDestinationEvent<any>, SynoChatPayload> {
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
    let endpoint = undefined;

    if (msg.destinationType === SynoChatDestinationType.BOT) {
      data.user_ids = msg.users;

      if (!Object.keys(SYNO_ENDPOINTS.bot).includes(msg.destination)) {
        logger.info(`Bot '${msg.destination}' not found, nothing to do.`);
        return;
      } else {
        endpoint = SYNO_ENDPOINTS.bot[msg.destination];
      }
    } else {
      if (!Object.keys(SYNO_ENDPOINTS.channel).includes(msg.destination)) {
        logger.info(`Channel '${msg.destination}' not found, nothing to do.`);
        return;
      } else {
        endpoint = SYNO_ENDPOINTS.channel[msg.destination];
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
