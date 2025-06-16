import { Module } from "@nestjs/common";
import { CreateBatchJobController } from "../controller/job/batch/CreateBatchJob";
import { CreateRedriveJobController } from "../controller/job/batch/CreateRedriveJob";
import { DeleteBatchJobController } from "../controller/job/batch/DeleteBatchJob";
import { DescribeBatchJobController } from "../controller/job/batch/DescribeBatchJob";
import { GetBatchJobLogsController } from "../controller/job/batch/GetBatchJobLogs";
import { GetBatchJobStatisticsController } from "../controller/job/batch/GetBatchJobStatistics";
import { GetBatchJobStatsByTypeController } from "../controller/job/batch/GetBatchJobStatsByType";
import { ListBatchJobsController } from "../controller/job/batch/ListBatchJobs";
import { ListBatchJobsByTypeController } from "../controller/job/batch/ListBatchJobsByType";
import { UpdateBatchJobController } from "../controller/job/batch/UpdateBatchJob";
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
    GetBatchJobLogsController,
    GetBatchJobStatisticsController,
    GetBatchJobStatsByTypeController,
    ListBatchJobsController,
    ListBatchJobsByTypeController,
    UpdateBatchJobController,
  ],
})
export class BatchJobApiModule {}
