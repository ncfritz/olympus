import { Module } from "@nestjs/common";
import { CreateMetadataWorkflowController } from "../controller/metadata/workflow/CreateMetadataWorkflow";
import { CreateMetadataWorkflowStepController } from "../controller/metadata/workflow/CreateMetadataWorkflowStep";
import { DescribeMetadataWorkflowController } from "../controller/metadata/workflow/DescribeMetadataWorkflow";
import { DescribeMetadataWorkflowStepController } from "../controller/metadata/workflow/DescribeMetadataWorkflowStep";
import { ListMetadataWorkflowsController } from "../controller/metadata/workflow/ListMetadataWorkflows";
import { ListMetadataWorkflowStepsController } from "../controller/metadata/workflow/ListMetadataWorkflowSteps";
import { UpdateWorkflowController } from "../controller/metadata/workflow/UpdateMetadataWorkflow";
import { GraphQLClientModule } from "./GraphQLClientModule";
import { RabbitModule } from "./RabbitModule";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
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
