import { Module } from "@nestjs/common";
import { SyncModule } from "../sync/SyncModule";
import { CalendarAuthController } from "./controllers/CalendarAuthController";
import { CalendarAuthService } from "./services/CalendarAuthService";

@Module({
  imports: [SyncModule],
  controllers: [CalendarAuthController],
  providers: [CalendarAuthService],
  exports: [CalendarAuthService],
})
export class CalendarAuthModule {}
