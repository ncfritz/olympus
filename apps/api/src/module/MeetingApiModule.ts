import { CreateCalendarItemController } from "../controller/calendar/CreateCalendarItem";
import { Module } from "@nestjs/common";
import { DeleteCalendarItemController } from "../controller/calendar/DeleteCalendarItem";
import { DescribeCalendarItemController } from "../controller/calendar/DescribeCalendarItem";
import { GetMeetingsSummaryController } from "../controller/calendar/GetMeetingsSummary";
import { ListCalendarItemsController } from "../controller/calendar/ListCalendarItems";
import { UpdateCalendarItemController } from "../controller/calendar/UpdateCalendarItem";
import { GraphQLClientModule } from "./GraphQLClientModule";

@Module({
  imports: [GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
    CreateCalendarItemController,
    GetMeetingsSummaryController,
    DeleteCalendarItemController,
    DescribeCalendarItemController,
    ListCalendarItemsController,
    UpdateCalendarItemController,
  ],
})
export class MeetingApiModule {}
