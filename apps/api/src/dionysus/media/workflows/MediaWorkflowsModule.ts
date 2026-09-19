import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { MediaSearchResultsModule } from "../searchResults/MediaSearchResultsModule";
import { MediaAssetWorkflowService } from "./services/MediaAssetWorkflowService";
import { ApproveMediaAssetTranscodeConfigurationController } from "./controllers/ApproveMediaAssetTranscodeConfigurationController";
import { CreateMediaAssetWorkflowController } from "./controllers/CreateMediaAssetWorkflowController";
import { CreateMediaAssetWorkflowStepController } from "./controllers/CreateMediaAssetWorkflowStepController";
import { CreateMediaAssetWorkflowSubStepController } from "./controllers/CreateMediaAssetWorkflowSubStepController";
import { DeleteMediaAssetWorkflowController } from "./controllers/DeleteMediaAssetWorkflowController";
import { DescribeMediaAssetWorkflowController } from "./controllers/DescribeMediaAssetWorkflowController";
import { DescribeMediaAssetWorkflowStepController } from "./controllers/DescribeMediaAssetWorkflowStepController";
import { ListMediaAssetTranscodesController } from "./controllers/ListMediaAssetTranscodesController";
import { ListMediaAssetWorkflowsController } from "./controllers/ListMediaAssetWorkflowsController";
import { UpdateMediaAssetWorkflowController } from "./controllers/UpdateMediaAssetWorkflowController";
import { UpdateMediaAssetWorkflowStepController } from "./controllers/UpdateMediaAssetWorkflowStepController";
import { VerifyMediaAssetTranscodeConfigurationController } from "./controllers/VerifyMediaAssetTranscodeConfigurationController";

@Module({
  imports: [RabbitModule, GraphQLClientModule, MediaSearchResultsModule],
  providers: [MediaAssetWorkflowService],
  controllers: [
    ApproveMediaAssetTranscodeConfigurationController,
    CreateMediaAssetWorkflowController,
    CreateMediaAssetWorkflowStepController,
    CreateMediaAssetWorkflowSubStepController,
    DeleteMediaAssetWorkflowController,
    DescribeMediaAssetWorkflowController,
    DescribeMediaAssetWorkflowStepController,
    ListMediaAssetTranscodesController,
    ListMediaAssetWorkflowsController,
    UpdateMediaAssetWorkflowController,
    UpdateMediaAssetWorkflowStepController,
    VerifyMediaAssetTranscodeConfigurationController,
  ],
})
export class MediaWorkflowsModule {}
