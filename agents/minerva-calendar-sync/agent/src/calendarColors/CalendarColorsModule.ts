import { Module } from "@nestjs/common";
import { StoreModule } from "../store/StoreModule";
import { ListCalendarColorsController } from "./controllers/ListCalendarColorsController";
import { UpdateCalendarColorController } from "./controllers/UpdateCalendarColorController";
import { CalendarColorService } from "./services/CalendarColorService";

@Module({
  imports: [StoreModule],
  controllers: [ListCalendarColorsController, UpdateCalendarColorController],
  providers: [CalendarColorService],
})
export class CalendarColorsModule {}
