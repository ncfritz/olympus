import { Module } from "@nestjs/common";
import { CreateBatchJobController } from "../controller/dionysus/job/batch/CreateBatchJob";
import { CreateRedriveJobController } from "../controller/dionysus/job/batch/CreateRedriveJob";
import { DeleteBatchJobController } from "../controller/dionysus/job/batch/DeleteBatchJob";
import { DescribeBatchJobController } from "../controller/dionysus/job/batch/DescribeBatchJob";
import { GetBatchJobStatsController } from "../controller/dionysus/job/batch/GetBatchJobStats";
import { GetBatchJobStatsByTypeController } from "../controller/dionysus/job/batch/GetBatchJobStatsByType";
import { ListBatchJobsController } from "../controller/dionysus/job/batch/ListBatchJobs";
import { ListBatchJobsByTypeController } from "../controller/dionysus/job/batch/ListBatchJobsByType";
import { UpdateBatchJobController } from "../controller/dionysus/job/batch/UpdateBatchJob";
import { GraphQLClientModule } from "./GraphQLClientModule";
import { RabbitModule } from "./RabbitModule";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
    CreateBatchJobController,
    CreateRedriveJobController,
    DeleteBatchJobController,
    DescribeBatchJobController,
    GetBatchJobStatsController,
    GetBatchJobStatsByTypeController,
    ListBatchJobsController,
    ListBatchJobsByTypeController,
    UpdateBatchJobController,
  ],
})
export class BatchJobApiModule {}
