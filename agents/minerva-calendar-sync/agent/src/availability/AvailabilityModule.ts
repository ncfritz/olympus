import { Module } from "@nestjs/common";
import { StoreModule } from "../store/StoreModule";
import { SyncModule } from "../sync/SyncModule";
import { AvailabilityController } from "./controllers/AvailabilityController";
import { AvailabilityService } from "./services/AvailabilityService";

@Module({
  imports: [StoreModule, SyncModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
})
export class AvailabilityModule {}
