import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { SyncModule } from "../sync/sync.module";
import { AvailabilityController } from "./availability.controller";
import { AvailabilityService } from "./availability.service";

@Module({
  imports: [StoreModule, SyncModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
})
export class AvailabilityModule {}
