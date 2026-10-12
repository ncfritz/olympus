import { Module } from "@nestjs/common";
import { GetDashboardController } from "./controllers/GetDashboardController";
import { DashboardService } from "./services/DashboardService";

/** The console's dashboard: the CA at a glance. */
@Module({
  controllers: [GetDashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
