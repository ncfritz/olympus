import { Controller, Headers, HttpCode, Post } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "../auth/public.decorator";
import { WebhookNotifier } from "../sync/webhook-notifier";

/**
 * Receives Google Calendar push notifications. The payload carries no
 * change data, only headers identifying the channel and its state — the
 * actual diff/upsert happens via SyncEngine once WebhookNotifier signals
 * a change, same as a poll tick.
 */
@ApiExcludeController() // for Google, not an app client — not part of the public API surface
@Public()
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly webhookNotifier: WebhookNotifier) {}

  @Post("google")
  @HttpCode(200)
  handleGoogleNotification(
    @Headers("x-goog-channel-id") channelId: string | undefined,
    @Headers("x-goog-resource-state") resourceState: string | undefined,
    @Headers("x-goog-channel-token") token: string | undefined,
  ): void {
    // "sync" is just Google's initial handshake confirming the channel was
    // created — not a real change to react to.
    if (!channelId || resourceState === "sync") return;

    this.webhookNotifier.handleNotification(channelId, token);
  }
}
