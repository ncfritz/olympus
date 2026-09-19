import { Module } from "@nestjs/common";
import { RabbitModule } from "../../infra/RabbitModule";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { CreateMetadataWorkflowController } from "./controllers/CreateMetadataWorkflowController";
import { CreateMetadataWorkflowStepController } from "./controllers/CreateMetadataWorkflowStepController";
import { DescribeMetadataWorkflowController } from "./controllers/DescribeMetadataWorkflowController";
import { DescribeMetadataWorkflowStepController } from "./controllers/DescribeMetadataWorkflowStepController";
import { GetMetadataWorkflowStatisticsController } from "./controllers/GetMetadataWorkflowStatisticsController";
import { ListMetadataWorkflowStepsController } from "./controllers/ListMetadataWorkflowStepsController";
import { ListMetadataWorkflowsController } from "./controllers/ListMetadataWorkflowsController";
import { UpdateMetadataWorkflowController } from "./controllers/UpdateMetadataWorkflowController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [
    // Before the /:workflowId routes, which would otherwise match /stats.
    GetMetadataWorkflowStatisticsController,
    CreateMetadataWorkflowController,
    CreateMetadataWorkflowStepController,
    DescribeMetadataWorkflowController,
    DescribeMetadataWorkflowStepController,
    ListMetadataWorkflowStepsController,
    ListMetadataWorkflowsController,
    UpdateMetadataWorkflowController,
  ],
})
export class MetadataWorkflowsModule {}
