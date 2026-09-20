import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { GoogleCredentialStore } from "../providers/google/GoogleCredentialStore";
import { MicrosoftCredentialStore } from "../providers/microsoft/MicrosoftCredentialStore";
import { CalendarProviderRegistry } from "../providers/services/CalendarProviderRegistry";
import { StoreModule } from "../store/StoreModule";
import { PollingNotifier } from "./services/PollingNotifier";
import { SyncBootstrapService } from "./services/SyncBootstrapService";
import { SyncConfigService } from "./services/SyncConfigService";
import { SyncEngine } from "./services/SyncEngine";
import { SyncHistoryPrunerService } from "./services/SyncHistoryPrunerService";
import { WebhookNotifier } from "./services/WebhookNotifier";

@Module({
  imports: [ScheduleModule.forRoot(), StoreModule],
  providers: [
    SyncEngine,
    SyncConfigService,
    CalendarProviderRegistry,
    GoogleCredentialStore,
    MicrosoftCredentialStore,
    PollingNotifier,
    WebhookNotifier,
    SyncBootstrapService,
    SyncHistoryPrunerService,
  ],
  exports: [
    SyncEngine,
    SyncConfigService,
    CalendarProviderRegistry,
    GoogleCredentialStore,
    MicrosoftCredentialStore,
    WebhookNotifier,
  ],
})
export class SyncModule {}
