import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateBatchJobController } from "./controllers/CreateBatchJobController";
import { CreateRedriveJobController } from "./controllers/CreateRedriveJobController";
import { DeleteBatchJobController } from "./controllers/DeleteBatchJobController";
import { DescribeBatchJobController } from "./controllers/DescribeBatchJobController";
import { GetBatchJobStatsByTypeController } from "./controllers/GetBatchJobStatsByTypeController";
import { GetBatchJobStatsController } from "./controllers/GetBatchJobStatsController";
import { ListBatchJobsByTypeController } from "./controllers/ListBatchJobsByTypeController";
import { ListBatchJobsController } from "./controllers/ListBatchJobsController";
import { UpdateBatchJobController } from "./controllers/UpdateBatchJobController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [
    CreateBatchJobController,
    CreateRedriveJobController,
    DeleteBatchJobController,
    DescribeBatchJobController,
    GetBatchJobStatsByTypeController,
    GetBatchJobStatsController,
    ListBatchJobsByTypeController,
    ListBatchJobsController,
    UpdateBatchJobController,
  ],
})
export class BatchJobsModule {}
