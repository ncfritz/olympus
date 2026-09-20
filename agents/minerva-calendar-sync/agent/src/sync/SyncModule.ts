import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { CalendarProviderRegistry } from "../providers/services/CalendarProviderRegistry";
import { StoreModule } from "../store/StoreModule";
import { MicrosoftWebhooksController } from "../webhooks/controllers/MicrosoftWebhooksController";
import { WebhooksController } from "../webhooks/controllers/WebhooksController";
import { PollingNotifier } from "./services/PollingNotifier";
import { SyncBootstrapService } from "./services/SyncBootstrapService";
import { SyncConfigService } from "./services/SyncConfigService";
import { SyncEngine } from "./services/SyncEngine";
import { SyncHistoryController } from "./controllers/SyncHistoryController";
import { SyncHistoryPrunerService } from "./services/SyncHistoryPrunerService";
import { WebhookNotifier } from "./services/WebhookNotifier";

@Module({
  imports: [ScheduleModule.forRoot(), StoreModule],
  controllers: [
    WebhooksController,
    MicrosoftWebhooksController,
    SyncHistoryController,
  ],
  providers: [
    SyncEngine,
    SyncConfigService,
    CalendarProviderRegistry,
    PollingNotifier,
    WebhookNotifier,
    SyncBootstrapService,
    SyncHistoryPrunerService,
  ],
  exports: [SyncEngine, SyncConfigService, CalendarProviderRegistry],
})
export class SyncModule {}
