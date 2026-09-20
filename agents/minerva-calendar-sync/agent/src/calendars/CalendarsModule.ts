import { Module } from "@nestjs/common";
import { CalendarAuthModule } from "../calendarAuth/CalendarAuthModule";
import { StoreModule } from "../store/StoreModule";
import { SyncModule } from "../sync/SyncModule";
import { CalendarsController } from "./controllers/CalendarsController";

@Module({
  imports: [StoreModule, SyncModule, CalendarAuthModule],
  controllers: [CalendarsController],
})
export class CalendarsModule {}
