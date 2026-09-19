import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateContentIngestionWorkflowController } from "./controllers/CreateContentIngestionWorkflowController";
import { CreateContentIngestionWorkflowStepController } from "./controllers/CreateContentIngestionWorkflowStepController";
import { DescribeContentIngestionWorkflowController } from "./controllers/DescribeContentIngestionWorkflowController";
import { GetContentIngestionWorkflowStatisticsController } from "./controllers/GetContentIngestionWorkflowStatisticsController";
import { ListContentIngestionWorkflowsController } from "./controllers/ListContentIngestionWorkflowsController";
import { UpdateContentIngestionWorkflowController } from "./controllers/UpdateContentIngestionWorkflowController";
import { UpdateContentIngestionWorkflowStepController } from "./controllers/UpdateContentIngestionWorkflowStepController";
import { UploadAssetsController } from "./controllers/UploadAssetsController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [
    // Before the /:workflowId routes, which would otherwise match /stats.
    GetContentIngestionWorkflowStatisticsController,
    CreateContentIngestionWorkflowController,
    CreateContentIngestionWorkflowStepController,
    DescribeContentIngestionWorkflowController,
    ListContentIngestionWorkflowsController,
    UpdateContentIngestionWorkflowController,
    UpdateContentIngestionWorkflowStepController,
    UploadAssetsController,
  ],
})
export class ContentWorkflowsModule {}
