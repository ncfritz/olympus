import {
  BaseDestinationEvent,
  WebSocketDestinationEvent,
} from "../../types/destinations";
import { DionysusMediaAssetSearchRefreshCompleteContext } from "../../types/dionysus";
import { WebSocketPayload } from "../../types/payloads";
import { NotificationFormatter } from "../formatter";

export class MediaAssetSearchRefreshCompleteWebsocketFormatter extends NotificationFormatter<
  BaseDestinationEvent<DionysusMediaAssetSearchRefreshCompleteContext>,
  WebSocketPayload
> {
  async formatNotification(
    notification: WebSocketDestinationEvent<DionysusMediaAssetSearchRefreshCompleteContext>,
  ): Promise<WebSocketPayload> {
    return {
      type: "context",
      value: notification.context,
    };
  }
}
