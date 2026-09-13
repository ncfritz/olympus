import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { EventsController } from "./events.controller";

@Module({
  imports: [StoreModule],
  controllers: [EventsController],
})
export class EventsModule {}
