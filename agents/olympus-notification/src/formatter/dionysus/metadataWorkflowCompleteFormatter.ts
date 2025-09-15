import {
  BaseDestinationEvent,
  WebSocketDestinationEvent,
} from "../../types/destinations";
import { DionysusWorkflowContext } from "../../types/dionysus";
import { WebSocketPayload } from "../../types/payloads";
import { NotificationFormatter } from "../formatter";

export class MetadataWorkflowCompleteWebsocketFormatter extends NotificationFormatter<
  BaseDestinationEvent<DionysusWorkflowContext>,
  WebSocketPayload
> {
  async formatNotification(
    notification: WebSocketDestinationEvent<DionysusWorkflowContext>,
  ): Promise<WebSocketPayload> {
    return {
      type: "context",
      value: notification.context,
    };
  }
}
