import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { Inject, Injectable } from "@nestjs/common";
import axios from "axios";
import { synologyChatConfig } from "../../../config/configuration";
import type { SynologyChatConfigType } from "../../../config/configuration";
import { DeliveryHandler } from "../../../delivery/DeliveryHandler";
import type { SynoChatNotificationEvent } from "../../../delivery/events";
import {
  CHANNEL_SYNOCHAT,
  channelQueue,
  channelRoutingKey,
  NOTIFICATIONS_EXCHANGE,
} from "../../../messaging";
import { SynoChatFormatters } from "../formatters/SynoChatFormatters";
import type { SynoChatPayload } from "../payload";

type SynoChatEvent = SynoChatNotificationEvent<NotificationContext>;

type SynoChatEndpoints = {
  bot: Record<string, string>;
  channel: Record<string, string>;
};

const SYNO_CHAT_API = "webapi/entry.cgi?api=SYNO.Chat.External&version=2";

/** Messages to Synology Chat bots and channels (queue notifications.synochat). */
@Injectable()
export class SynoChatHandler extends DeliveryHandler<
  SynoChatEvent,
  SynoChatPayload
> {
  /**
   * Webhook URLs by destination name. A destination without a token is
   * treated as unknown.
   */
  private readonly endpoints: SynoChatEndpoints;

  constructor(
    private readonly formatters: SynoChatFormatters,
    @Inject(synologyChatConfig.KEY) synologyChat: SynologyChatConfigType,
  ) {
    super();
    const url = (
      method: string,
      token: string | undefined,
    ): Record<string, string> =>
      token
        ? {
            olympus: `${synologyChat.host}/${SYNO_CHAT_API}&method=${method}&token=%22${token}%22`,
          }
        : {};
    this.endpoints = {
      bot: url("chatbot", synologyChat.olympusBotToken),
      channel: url("incoming", synologyChat.olympusChannelToken),
    };
  }

  get channelName(): string {
    return "SynoChat";
  }

  @RabbitSubscribe({
    exchange: NOTIFICATIONS_EXCHANGE,
    queue: channelQueue(CHANNEL_SYNOCHAT),
    routingKey: channelRoutingKey(CHANNEL_SYNOCHAT),
  })
  async handle(notification: SynoChatEvent): Promise<void> {
    await this.deliver(notification);
  }

  protected formatterFor(notificationType: string) {
    return this.formatters.formatterFor(notificationType);
  }

  protected async send(
    msg: SynoChatEvent,
    payload: SynoChatPayload,
  ): Promise<void> {
    const data = { ...payload };
    let endpoint: string;

    if (msg.destinationType === "bot") {
      data.user_ids = msg.users;

      if (!Object.keys(this.endpoints.bot).includes(msg.destination)) {
        this.logger.log(`Bot '${msg.destination}' not found, nothing to do.`);
        return;
      }
      endpoint = this.endpoints.bot[msg.destination];
    } else {
      if (!Object.keys(this.endpoints.channel).includes(msg.destination)) {
        this.logger.log(
          `Channel '${msg.destination}' not found, nothing to do.`,
        );
        return;
      }
      endpoint = this.endpoints.channel[msg.destination];
    }

    this.logger.debug(`payload=${JSON.stringify(data)}"}`);

    const response = await axios.post(
      endpoint,
      `payload=${JSON.stringify(data)}"}`,
      { headers: { "Content-Type": "text/plain" } },
    );

    this.logger.debug(
      `Got response from SynologyChat: ${JSON.stringify(response.data)}`,
    );
  }
}
