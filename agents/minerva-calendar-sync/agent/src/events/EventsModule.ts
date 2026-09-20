import { Module } from "@nestjs/common";
import { StoreModule } from "../store/StoreModule";
import { DeleteEventOverrideController } from "./controllers/DeleteEventOverrideController";
import { DescribeEventController } from "./controllers/DescribeEventController";
import { DescribeEventOverrideController } from "./controllers/DescribeEventOverrideController";
import { ListEventOverridesController } from "./controllers/ListEventOverridesController";
import { ListEventsController } from "./controllers/ListEventsController";
import { UpdateEventOverrideController } from "./controllers/UpdateEventOverrideController";
import { EventOverrideService } from "./services/EventOverrideService";
import { EventService } from "./services/EventService";

@Module({
  imports: [StoreModule],
  controllers: [
    ListEventsController,
    DescribeEventController,
    ListEventOverridesController,
    DescribeEventOverrideController,
    UpdateEventOverrideController,
    DeleteEventOverrideController,
  ],
  providers: [EventService, EventOverrideService],
  exports: [EventService],
})
export class EventsModule {}
