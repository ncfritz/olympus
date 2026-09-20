import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ALL_CONFIG } from "./config/configuration";
import { AppController } from "./AppController";
import { AppService } from "./AppService";
import { AuthModule } from "./auth/AuthModule";
import { AvailabilityModule } from "./availability/AvailabilityModule";
import { CalendarAuthModule } from "./calendarAuth/CalendarAuthModule";
import { CalendarColorsModule } from "./calendarColors/CalendarColorsModule";
import { CalendarsModule } from "./calendars/CalendarsModule";
import { EventsModule } from "./events/EventsModule";
import { MetricsModule } from "./metrics/MetricsModule";
import { OutboxModule } from "./outbox/OutboxModule";
import { OverridesModule } from "./overrides/OverridesModule";
import { StoreModule } from "./store/StoreModule";
import { SyncModule } from "./sync/SyncModule";
import { SyncRunsModule } from "./syncRuns/SyncRunsModule";
import { WebhooksModule } from "./webhooks/WebhooksModule";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Typed namespaces (config/configuration.ts); the environment comes
      // from the process (`--env-file=dev.env`), validated by main.ts.
      ignoreEnvFile: true,
      load: ALL_CONFIG,
    }),
    MetricsModule,
    AuthModule,
    StoreModule,
    SyncModule,
    WebhooksModule,
    SyncRunsModule,
    EventsModule,
    CalendarsModule,
    CalendarAuthModule,
    CalendarColorsModule,
    AvailabilityModule,
    OverridesModule,
    OutboxModule.register(process.env.OUTBOX_ENABLED === "true"),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
