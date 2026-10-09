import { Module } from "@nestjs/common";
import { StoreModule } from "../store/StoreModule";
import { DescribeEventController } from "./controllers/DescribeEventController";
import { ListEventsController } from "./controllers/ListEventsController";
import { EventService } from "./services/EventService";

@Module({
  imports: [StoreModule],
  controllers: [ListEventsController, DescribeEventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventsModule {}
