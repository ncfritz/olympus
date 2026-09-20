import { Module } from "@nestjs/common";
import { SyncModule } from "../sync/SyncModule";
import { CalendarAuthController } from "./controllers/CalendarAuthController";
import { CalendarAuthService } from "./services/CalendarAuthService";
import { GoogleAuthStrategy } from "./strategies/GoogleAuthStrategy";
import { MicrosoftAuthStrategy } from "./strategies/MicrosoftAuthStrategy";

@Module({
  imports: [SyncModule],
  controllers: [CalendarAuthController],
  providers: [CalendarAuthService, GoogleAuthStrategy, MicrosoftAuthStrategy],
  exports: [CalendarAuthService],
})
export class CalendarAuthModule {}
