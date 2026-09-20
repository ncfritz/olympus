import {
  Controller,
  Headers,
  HttpCode,
  Post,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "../../auth/public";
import { WebhookNotifier } from "../../sync/services/WebhookNotifier";

/**
 * Receives Google Calendar push notifications. The payload carries no
 * change data, only headers identifying the channel and its state — the
 * actual diff/upsert happens via SyncEngine once WebhookNotifier signals
 * a change, same as a poll tick.
 */
// A provider callback (ADR 0016): the path is registered with Google, so it
// is unversioned and outside the management API document.
@ApiExcludeController()
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class GoogleWebhookController {
  constructor(private readonly webhookNotifier: WebhookNotifier) {}

  @Post("/webhooks/google")
  @HttpCode(200)
  handle(
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
