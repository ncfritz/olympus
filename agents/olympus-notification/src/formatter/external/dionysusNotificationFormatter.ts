import {
  BaseDestinationEvent,
  WebSocketDestinationEvent,
} from "../../types/destinations";
import { DionysusBatchJobContext } from "../../types/dionysus";
import { WebSocketPayload } from "../../types/payloads";
import { NotificationFormatter } from "../formatter";

export class BatchJobCompleteWebsocketFormatter extends NotificationFormatter<
  BaseDestinationEvent<DionysusBatchJobContext>,
  WebSocketPayload
> {
  async formatNotification(
    notification: WebSocketDestinationEvent<DionysusBatchJobContext>,
  ): Promise<WebSocketPayload> {
    return {
      type: "context",
      value: notification.context,
    };
  }
}
