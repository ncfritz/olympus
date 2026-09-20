import { Module } from "@nestjs/common";
import { StoreModule } from "../store/StoreModule";
import { EventsController } from "./controllers/EventsController";

@Module({
  imports: [StoreModule],
  controllers: [EventsController],
})
export class EventsModule {}
