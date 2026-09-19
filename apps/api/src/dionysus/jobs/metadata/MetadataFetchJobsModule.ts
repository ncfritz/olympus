import { Module } from "@nestjs/common";
import { MetadataFetchJobService } from "./services/MetadataFetchJobService";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateMetadataFetchJobController } from "./controllers/CreateMetadataFetchJobController";
import { DeleteMetadataFetchJobController } from "./controllers/DeleteMetadataFetchJobController";
import { DescribeMetadataFetchJobController } from "./controllers/DescribeMetadataFetchJobController";
import { GetMetadataFetchJobStatisticsController } from "./controllers/GetMetadataFetchJobStatisticsController";
import { ListMetadataFetchJobsController } from "./controllers/ListMetadataFetchJobsController";
import { ScrollMetadataFetchJobsController } from "./controllers/ScrollMetadataFetchJobsController";
import { UpdateMetadataFetchJobController } from "./controllers/UpdateMetadataFetchJobController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [MetadataFetchJobService],
  controllers: [
    CreateMetadataFetchJobController,
    DeleteMetadataFetchJobController,
    DescribeMetadataFetchJobController,
    GetMetadataFetchJobStatisticsController,
    ListMetadataFetchJobsController,
    ScrollMetadataFetchJobsController,
    UpdateMetadataFetchJobController,
  ],
})
export class MetadataFetchJobsModule {}
