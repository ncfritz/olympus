import { Module } from "@nestjs/common";
import { StoreModule } from "../store/StoreModule";
import { DescribeSyncRunController } from "./controllers/DescribeSyncRunController";
import { GetSyncRunStatsController } from "./controllers/GetSyncRunStatsController";
import { ListSyncRunsController } from "./controllers/ListSyncRunsController";
import { SyncRunService } from "./services/SyncRunService";

/** The sync history (the Sync page). */
@Module({
  imports: [StoreModule],
  controllers: [
    ListSyncRunsController,
    GetSyncRunStatsController,
    DescribeSyncRunController,
  ],
  providers: [SyncRunService],
})
export class SyncRunsModule {}
