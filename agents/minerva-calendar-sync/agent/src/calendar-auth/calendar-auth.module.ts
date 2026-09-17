import { Module } from "@nestjs/common";
import { SyncModule } from "../sync/sync.module";
import { CalendarAuthController } from "./calendar-auth.controller";
import { CalendarAuthService } from "./calendar-auth.service";

@Module({
  imports: [SyncModule],
  controllers: [CalendarAuthController],
  providers: [CalendarAuthService],
  exports: [CalendarAuthService],
})
export class CalendarAuthModule {}
