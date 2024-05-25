import { CreateCalendarItemController } from "../controller/calendar/CreateCalendarItem";
import { Module } from "@nestjs/common";
import { DeleteCalendarItemController } from "../controller/calendar/DeleteCalendarItemController";
import { DescribeCalendarItemController } from "../controller/calendar/DescribeCalendarItemController";
import { GetMeetingsSummaryController } from "../controller/calendar/GetMeetingsSummary";
import { ListCalendarItemsController } from "../controller/calendar/ListCalendarItemsController";
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
  ],
})
export class MeetingApiModule {}
