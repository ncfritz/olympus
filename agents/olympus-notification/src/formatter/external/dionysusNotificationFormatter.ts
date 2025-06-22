import {
  BaseDestinationEvent,
  WebSocketDestinationEvent,
  WebSocketPayload,
} from "@ncfritz/olympus-model/dist/notifications";
import { DionysusBatchJobContext } from "../../types/dionysus";
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
