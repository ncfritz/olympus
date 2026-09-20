import {
  Body,
  Controller,
  HttpCode,
  Post,
  Query,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../../auth/public";
import { WebhookNotifier } from "../../sync/services/WebhookNotifier";

interface GraphNotification {
  subscriptionId?: string;
  clientState?: string;
}

interface GraphNotificationBody {
  value?: GraphNotification[];
}

/**
 * Receives Microsoft Graph change notifications for calendar subscriptions.
 * Unlike Google (channel id/state delivered via headers, no body), Graph:
 *  - synchronously validates a new (or renewed) subscription by POSTing here
 *    with a `validationToken` query param, expecting it echoed straight back
 *    as `text/plain` within 10 seconds — done before any change ever occurs;
 *  - otherwise POSTs a JSON body of one or more batched notifications, each
 *    carrying its own subscriptionId/clientState but never the actual
 *    change — the same "something may have changed" signal
 *    WebhookNotifier.handleNotification expects, called once per entry.
 */
// A provider callback (ADR 0016): the path is registered with Microsoft, so
// it is unversioned and outside the management API document.
@ApiExcludeController()
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class MicrosoftWebhookController {
  constructor(private readonly webhookNotifier: WebhookNotifier) {}

  @Post("/webhooks/microsoft")
  @HttpCode(200)
  handle(
    @Query("validationToken") validationToken: string | undefined,
    @Body() body: GraphNotificationBody | undefined,
    @Res() res: Response,
  ): void {
    if (validationToken !== undefined) {
      res.setHeader("Content-Type", "text/plain");
      res.status(200).send(validationToken);
      return;
    }

    for (const notification of body?.value ?? []) {
      if (notification.subscriptionId) {
        this.webhookNotifier.handleNotification(
          notification.subscriptionId,
          notification.clientState,
        );
      }
    }
    res.status(202).send();
  }
}
