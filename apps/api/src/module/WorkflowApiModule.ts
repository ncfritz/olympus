import { Module } from "@nestjs/common";
import { CreateMetadataWorkflowController } from "../controller/dionysus/workflow/CreateMetadataWorkflow";
import { CreateMetadataWorkflowStepController } from "../controller/dionysus/workflow/CreateMetadataWorkflowStep";
import { DescribeMetadataWorkflowController } from "../controller/dionysus/workflow/DescribeMetadataWorkflow";
import { DescribeMetadataWorkflowStepController } from "../controller/dionysus/workflow/DescribeMetadataWorkflowStep";
import { GetMetadataWorkflowStatisticsController } from "../controller/dionysus/workflow/GetMetadataWorkflowStatistics";
import { ListMetadataWorkflowsController } from "../controller/dionysus/workflow/ListMetadataWorkflows";
import { ListMetadataWorkflowStepsController } from "../controller/dionysus/workflow/ListMetadataWorkflowSteps";
import { UpdateWorkflowController } from "../controller/dionysus/workflow/UpdateMetadataWorkflow";
import { GraphQLClientModule } from "./GraphQLClientModule";
import { RabbitModule } from "./RabbitModule";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
    GetMetadataWorkflowStatisticsController,
    CreateMetadataWorkflowController,
    CreateMetadataWorkflowStepController,
    DescribeMetadataWorkflowController,
    DescribeMetadataWorkflowStepController,
    ListMetadataWorkflowsController,
    ListMetadataWorkflowStepsController,
    UpdateWorkflowController,
  ],
})
export class WorkflowApiModule {}
