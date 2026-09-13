import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { CalendarProviderRegistry } from "../providers/calendar-provider-registry";
import { StoreModule } from "../store/store.module";
import { PollingNotifier } from "./polling-notifier";
import { SyncBootstrapService } from "./sync-bootstrap.service";
import { SyncConfigService } from "./sync-config.service";
import { SyncEngine } from "./sync-engine";

@Module({
  imports: [ScheduleModule.forRoot(), StoreModule],
  providers: [SyncEngine, SyncConfigService, CalendarProviderRegistry, PollingNotifier, SyncBootstrapService],
  exports: [SyncEngine, SyncConfigService],
})
export class SyncModule {}
