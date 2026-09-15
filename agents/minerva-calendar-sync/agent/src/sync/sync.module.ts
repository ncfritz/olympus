import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { CalendarProviderRegistry } from "../providers/calendar-provider-registry";
import { StoreModule } from "../store/store.module";
import { WebhooksController } from "../webhooks/webhooks.controller";
import { PollingNotifier } from "./polling-notifier";
import { SyncBootstrapService } from "./sync-bootstrap.service";
import { SyncConfigService } from "./sync-config.service";
import { SyncEngine } from "./sync-engine";
import { WebhookNotifier } from "./webhook-notifier";

@Module({
  imports: [ScheduleModule.forRoot(), StoreModule],
  controllers: [WebhooksController],
  providers: [
    SyncEngine,
    SyncConfigService,
    CalendarProviderRegistry,
    PollingNotifier,
    WebhookNotifier,
    SyncBootstrapService,
  ],
  exports: [SyncEngine, SyncConfigService],
})
export class SyncModule {}
