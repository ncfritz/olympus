import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { CreateCalendarItemController } from "./controllers/CreateCalendarItemController";
import { DeleteCalendarItemController } from "./controllers/DeleteCalendarItemController";
import { DescribeCalendarItemController } from "./controllers/DescribeCalendarItemController";
import { GetMeetingsStatisticsController } from "./controllers/GetMeetingsStatisticsController";
import { GetMeetingsSummaryController } from "./controllers/GetMeetingsSummaryController";
import { GetNextCalendarItemOccurrenceController } from "./controllers/GetNextCalendarItemOccurrenceController";
import { ListCalendarItemsController } from "./controllers/ListCalendarItemsController";
import { ListPreviousCalendarItemOccurrencesController } from "./controllers/ListPreviousCalendarItemOccurrencesController";
import { UpdateCalendarItemController } from "./controllers/UpdateCalendarItemController";

@Module({
  imports: [GraphQLClientModule],
  controllers: [
    CreateCalendarItemController,
    DeleteCalendarItemController,
    DescribeCalendarItemController,
    GetMeetingsStatisticsController,
    GetMeetingsSummaryController,
    GetNextCalendarItemOccurrenceController,
    ListCalendarItemsController,
    ListPreviousCalendarItemOccurrencesController,
    UpdateCalendarItemController,
  ],
})
export class MeetingsModule {}
