import { Module } from "@nestjs/common";
import { MinervaCalendarAgentClient } from "./services/MinervaCalendarAgentClient";

/**
 * Calendar accounts and calendars, by user (ADR 0028): the API's side of
 * the calendar sync agent. Its operations arrive in calendar users phase 4;
 * this holds the agent's client (phase 3).
 */
@Module({
  providers: [MinervaCalendarAgentClient],
  exports: [MinervaCalendarAgentClient],
})
export class CalendarsModule {}
