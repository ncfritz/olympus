import { Module } from "@nestjs/common";
import { CalendarAuthModule } from "../calendar-auth/calendar-auth.module";
import { StoreModule } from "../store/store.module";
import { SyncModule } from "../sync/sync.module";
import { CalendarsController } from "./calendars.controller";

@Module({
  imports: [StoreModule, SyncModule, CalendarAuthModule],
  controllers: [CalendarsController],
})
export class CalendarsModule {}
