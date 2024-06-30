import { CreateCalendarItemController } from "../controller/calendar/CreateCalendarItem";
import { Module } from "@nestjs/common";
import { DeleteCalendarItemController } from "../controller/calendar/DeleteCalendarItem";
import { DescribeCalendarItemController } from "../controller/calendar/DescribeCalendarItem";
import { GetMeetingsSummaryController } from "../controller/calendar/GetMeetingsSummary";
import { GetNextCalendarItemOccurrenceController } from "../controller/calendar/GetNextCalendarItemOccurrence";
import { ListCalendarItemsController } from "../controller/calendar/ListCalendarItems";
import { ListPreviousCalendarItemOccurrencesController } from "../controller/calendar/ListPreviousCalendarItemOccurrences";
import { UpdateCalendarItemController } from "../controller/calendar/UpdateCalendarItem";
import { GraphQLClientModule } from "./GraphQLClientModule";

@Module({
  imports: [GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
    CreateCalendarItemController,
    GetMeetingsSummaryController,
    GetNextCalendarItemOccurrenceController,
    DeleteCalendarItemController,
    DescribeCalendarItemController,
    ListCalendarItemsController,
    ListPreviousCalendarItemOccurrencesController,
    UpdateCalendarItemController,
  ],
})
export class MeetingApiModule {}
