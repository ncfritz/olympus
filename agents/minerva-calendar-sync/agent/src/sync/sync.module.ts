import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { CalendarProviderRegistry } from "../providers/calendar-provider-registry";
import { StoreModule } from "../store/store.module";
import { MicrosoftWebhooksController } from "../webhooks/microsoft-webhooks.controller";
import { WebhooksController } from "../webhooks/webhooks.controller";
import { PollingNotifier } from "./polling-notifier";
import { SyncBootstrapService } from "./sync-bootstrap.service";
import { SyncConfigService } from "./sync-config.service";
import { SyncEngine } from "./sync-engine";
import { SyncHistoryController } from "./sync-history.controller";
import { SyncHistoryPrunerService } from "./sync-history-pruner.service";
import { WebhookNotifier } from "./webhook-notifier";

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
