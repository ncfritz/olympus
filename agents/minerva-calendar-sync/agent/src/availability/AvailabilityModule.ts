import { Module } from "@nestjs/common";
import { StoreModule } from "../store/StoreModule";
import { SyncModule } from "../sync/SyncModule";
import { GetFreeBusyController } from "./controllers/GetFreeBusyController";
import { GetStatusTimelineController } from "./controllers/GetStatusTimelineController";
import { AvailabilityService } from "./services/AvailabilityService";

@Module({
  imports: [StoreModule, SyncModule],
  controllers: [GetFreeBusyController, GetStatusTimelineController],
  providers: [AvailabilityService],
})
export class AvailabilityModule {}
