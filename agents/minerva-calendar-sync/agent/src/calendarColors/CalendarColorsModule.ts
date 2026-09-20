import { Module } from "@nestjs/common";
import { StoreModule } from "../store/StoreModule";
import { CalendarColorsController } from "./controllers/CalendarColorsController";

@Module({
  imports: [StoreModule],
  controllers: [CalendarColorsController],
})
export class CalendarColorsModule {}
