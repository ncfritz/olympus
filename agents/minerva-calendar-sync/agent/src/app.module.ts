import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { AvailabilityModule } from "./availability/availability.module";
import { CalendarColorsModule } from "./calendar-colors/calendar-colors.module";
import { CalendarsModule } from "./calendars/calendars.module";
import { EventsModule } from "./events/events.module";
import { OverridesModule } from "./overrides/overrides.module";
import { StoreModule } from "./store/store.module";
import { SyncModule } from "./sync/sync.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    StoreModule,
    SyncModule,
    EventsModule,
    CalendarsModule,
    CalendarColorsModule,
    AvailabilityModule,
    OverridesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
