import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./AppController";
import { AppService } from "./AppService";
import { AuthModule } from "./auth/AuthModule";
import { AvailabilityModule } from "./availability/AvailabilityModule";
import { CalendarAuthModule } from "./calendarAuth/CalendarAuthModule";
import { CalendarColorsModule } from "./calendarColors/CalendarColorsModule";
import { CalendarsModule } from "./calendars/CalendarsModule";
import { EventsModule } from "./events/EventsModule";
import { OutboxModule } from "./outbox/OutboxModule";
import { OverridesModule } from "./overrides/OverridesModule";
import { StoreModule } from "./store/StoreModule";
import { SyncModule } from "./sync/SyncModule";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    StoreModule,
    SyncModule,
    EventsModule,
    CalendarsModule,
    CalendarAuthModule,
    CalendarColorsModule,
    AvailabilityModule,
    OverridesModule,
    OutboxModule.register(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
