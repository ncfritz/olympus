import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { Injectable } from "@nestjs/common";
import type { WebSocketNotificationEvent } from "../../../delivery/events";
import type { NotificationFormatter } from "../../../delivery/NotificationFormatter";
import type { WebSocketPayload } from "../payload";
import { ContextWebSocketFormatter } from "./ContextWebSocketFormatter";
import { StaticStringWebSocketFormatter } from "./StaticStringWebSocketFormatter";

type WebSocketFormatter = NotificationFormatter<
  WebSocketNotificationEvent<NotificationContext>,
  WebSocketPayload
>;

/** WebSocket formatters by notification type. */
@Injectable()
export class WebSocketFormatters {
  private readonly byType: Record<string, WebSocketFormatter>;

  constructor() {
    const context = new ContextWebSocketFormatter();
    this.byType = {
      system_test: new StaticStringWebSocketFormatter(
        "Test",
        "This is a test message",
      ),
      dionysus_batch_job_complete: context,
      dionysus_metadata_workflow_completion: context,
      dionysus_media_asset_search_refresh_complete: context,
      dionysus_transcode_complete: context,
    };
  }

  formatterFor(notificationType: string): WebSocketFormatter | undefined {
    return this.byType[notificationType];
  }
}
