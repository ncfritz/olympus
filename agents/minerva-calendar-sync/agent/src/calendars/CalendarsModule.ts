import { Module } from "@nestjs/common";
import { CalendarAuthModule } from "../calendarAuth/CalendarAuthModule";
import { StoreModule } from "../store/StoreModule";
import { SyncModule } from "../sync/SyncModule";
import { BackfillCalendarController } from "./controllers/BackfillCalendarController";
import { CreateCalendarController } from "./controllers/CreateCalendarController";
import { DeleteCalendarController } from "./controllers/DeleteCalendarController";
import { ListCalendarsController } from "./controllers/ListCalendarsController";
import { SyncCalendarController } from "./controllers/SyncCalendarController";
import { UpdateCalendarController } from "./controllers/UpdateCalendarController";
import { CalendarService } from "./services/CalendarService";

@Module({
  imports: [StoreModule, SyncModule, CalendarAuthModule],
  controllers: [
    ListCalendarsController,
    CreateCalendarController,
    UpdateCalendarController,
    DeleteCalendarController,
    SyncCalendarController,
    BackfillCalendarController,
  ],
  providers: [CalendarService],
})
export class CalendarsModule {}
