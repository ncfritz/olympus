import { Module } from "@nestjs/common";
import { CreateCalendarItemController } from "../controller/minerva/calendar/CreateCalendarItem";
import { DeleteCalendarItemController } from "../controller/minerva/calendar/DeleteCalendarItem";
import { DescribeCalendarItemController } from "../controller/minerva/calendar/DescribeCalendarItem";
import { GetMeetingsStatisticsController } from "../controller/minerva/calendar/GetMeetingsStatistics";
import { GetMeetingsSummaryController } from "../controller/minerva/calendar/GetMeetingsSummary";
import { GetNextCalendarItemOccurrenceController } from "../controller/minerva/calendar/GetNextCalendarItemOccurrence";
import { ListCalendarItemsController } from "../controller/minerva/calendar/ListCalendarItems";
import { ListPreviousCalendarItemOccurrencesController } from "../controller/minerva/calendar/ListPreviousCalendarItemOccurrences";
import { UpdateCalendarItemController } from "../controller/minerva/calendar/UpdateCalendarItem";
import { GraphQLClientModule } from "./GraphQLClientModule";

@Module({
  imports: [GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
    CreateCalendarItemController,
    GetMeetingsStatisticsController,
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
