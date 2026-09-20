import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { CalendarColorsController } from "./calendar-colors.controller";

@Module({
  imports: [StoreModule],
  controllers: [CalendarColorsController],
})
export class CalendarColorsModule {}
