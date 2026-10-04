import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { RabbitModule } from "../../infra/RabbitModule";
import { AddCalendarController } from "./controllers/AddCalendarController";
import { ConfirmCalendarAccountClaimController } from "./controllers/ConfirmCalendarAccountClaimController";
import { CreateCalendarAccountClaimController } from "./controllers/CreateCalendarAccountClaimController";
import { DescribeCalendarAccountClaimController } from "./controllers/DescribeCalendarAccountClaimController";
import { ReleaseCalendarAccountController } from "./controllers/ReleaseCalendarAccountController";
import { CompleteCalendarAccountConnectController } from "./controllers/CompleteCalendarAccountConnectController";
import { ConnectCalendarAccountController } from "./controllers/ConnectCalendarAccountController";
import { DescribeCalendarAccountController } from "./controllers/DescribeCalendarAccountController";
import { ListAvailableCalendarsController } from "./controllers/ListAvailableCalendarsController";
import { ListCalendarAccountsController } from "./controllers/ListCalendarAccountsController";
import { ListCalendarsController } from "./controllers/ListCalendarsController";
import { ReauthorizeCalendarAccountController } from "./controllers/ReauthorizeCalendarAccountController";
import { RemoveCalendarAccountController } from "./controllers/RemoveCalendarAccountController";
import { RemoveCalendarController } from "./controllers/RemoveCalendarController";
import { UpdateCalendarController } from "./controllers/UpdateCalendarController";
import { CalendarEventHandler } from "./handlers/CalendarEventHandler";
import { CalendarAccountClaimService } from "./services/CalendarAccountClaimService";
import { CalendarAccountService } from "./services/CalendarAccountService";
import { CalendarEventService } from "./services/CalendarEventService";
import { CalendarService } from "./services/CalendarService";
import { MinervaCalendarAgentClient } from "./services/MinervaCalendarAgentClient";

/**
 * Calendar accounts and calendars, by user (ADR 0028): the API's side of
 * the calendar sync agent, and the consumer of its events.
 */
@Module({
  imports: [GraphQLClientModule, RabbitModule],
  controllers: [
    ListCalendarAccountsController,
    ConnectCalendarAccountController,
    CompleteCalendarAccountConnectController,
    DescribeCalendarAccountController,
    ReauthorizeCalendarAccountController,
    RemoveCalendarAccountController,
    ListAvailableCalendarsController,
    ListCalendarsController,
    AddCalendarController,
    UpdateCalendarController,
    RemoveCalendarController,
    CreateCalendarAccountClaimController,
    DescribeCalendarAccountClaimController,
    ConfirmCalendarAccountClaimController,
    ReleaseCalendarAccountController,
  ],
  providers: [
    CalendarAccountService,
    CalendarAccountClaimService,
    CalendarService,
    CalendarEventService,
    CalendarEventHandler,
    MinervaCalendarAgentClient,
  ],
  exports: [CalendarAccountService, MinervaCalendarAgentClient],
})
export class CalendarsModule {}
