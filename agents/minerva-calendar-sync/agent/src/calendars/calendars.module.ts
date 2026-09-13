import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { SyncModule } from "../sync/sync.module";
import { CalendarsController } from "./calendars.controller";

@Module({
  imports: [StoreModule, SyncModule],
  controllers: [CalendarsController],
})
export class CalendarsModule {}
