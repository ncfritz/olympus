import { Module } from "@nestjs/common";
import { SyncModule } from "../sync/SyncModule";
import { GoogleWebhookController } from "./controllers/GoogleWebhookController";
import { MicrosoftWebhookController } from "./controllers/MicrosoftWebhookController";

/** The providers' push notifications, handed to the sync engine. */
@Module({
  imports: [SyncModule],
  controllers: [GoogleWebhookController, MicrosoftWebhookController],
})
export class WebhooksModule {}
