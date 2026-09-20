import { Module } from "@nestjs/common";
import { SyncModule } from "../sync/SyncModule";
import { CreateCalendarAccountAuthorizationController } from "./controllers/CreateCalendarAccountAuthorizationController";
import { DescribeCalendarAccountAuthorizationController } from "./controllers/DescribeCalendarAccountAuthorizationController";
import { ListAvailableCalendarsController } from "./controllers/ListAvailableCalendarsController";
import { ListCalendarAccountsController } from "./controllers/ListCalendarAccountsController";
import { ReauthorizeCalendarAccountController } from "./controllers/ReauthorizeCalendarAccountController";
import { CalendarAccountService } from "./services/CalendarAccountService";
import { CalendarAuthService } from "./services/CalendarAuthService";
import { GoogleAuthStrategy } from "./strategies/GoogleAuthStrategy";
import { MicrosoftAuthStrategy } from "./strategies/MicrosoftAuthStrategy";

@Module({
  imports: [SyncModule],
  controllers: [
    ListCalendarAccountsController,
    CreateCalendarAccountAuthorizationController,
    DescribeCalendarAccountAuthorizationController,
    ReauthorizeCalendarAccountController,
    ListAvailableCalendarsController,
  ],
  providers: [
    CalendarAuthService,
    CalendarAccountService,
    GoogleAuthStrategy,
    MicrosoftAuthStrategy,
  ],
  exports: [CalendarAuthService],
})
export class CalendarAuthModule {}
