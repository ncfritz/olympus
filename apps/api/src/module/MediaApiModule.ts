import { Module } from "@nestjs/common";
import { ApproveMediaAssetTranscodeConfigurationController } from "../controller/dionysus/media/ApproveMediaAssetTranscodeConfiguration";
import { BulkUpdateMediaAssetDownloadsController } from "../controller/dionysus/media/BulkUpdateMediaAssetDownloads";
import { CreateMediaAssetController } from "../controller/dionysus/media/CreateMediaAsset";
import { CreateMediaAssetDownloadController } from "../controller/dionysus/media/CreateMediaAssetDownload";
import { CreateMediaFavoriteController } from "../controller/dionysus/media/CreateMediaFavorite";
import { CreateMediaAssetSearchConfigurationController } from "../controller/dionysus/media/CreateMediaAssetSearchConfiguration";
import { CreateMediaAssetSearchExecutionController } from "../controller/dionysus/media/CreateMediaAssetSearchExecution";
import { CreateMediaAssetSearchResultController } from "../controller/dionysus/media/CreateMediaAssetSearchResult";
import { CreateMediaAssetWorkflowController } from "../controller/dionysus/media/CreateMediaAssetWorkflow";
import { CreateMediaAssetWorkflowStepController } from "../controller/dionysus/media/CreateMediaAssetWorkflowStep";
import { CreateMediaAssetWorkflowSubStepController } from "../controller/dionysus/media/CreateMediaAssetWorkflowSubStep";
import { DeleteMediaFavoriteController } from "../controller/dionysus/media/DeleteMediaFavorite";
import { DeleteMediaAssetWorkflowController } from "../controller/dionysus/media/DeleteMediaAssetWorkflow";
import { DescribeMediaAssetSearchConfigurationController } from "../controller/dionysus/media/DescribeMediaAssetSearchConfiguration";
import { DescribeMediaAssetSearchExecutionController } from "../controller/dionysus/media/DescribeMediaAssetSearchExecution";
import { DescribeMediaAssetSearchResultController } from "../controller/dionysus/media/DescribeMediaAssetSearchResult";
import { DescribeMediaAssetWorkflowController } from "../controller/dionysus/media/DescribeMediaAssetWorkflow";
import { DescribeMediaAssetWorkflowStepController } from "../controller/dionysus/media/DescribeMediaAssetWorkflowStep";
import { GetMediaAssetSearchConfigurationsRunningCountController } from "../controller/dionysus/media/GetMediaAssetSearchConfigurationsRunningCount";
import { ListMediaAssetDownloadsController } from "../controller/dionysus/media/ListMediaAssetDownloads";
import { ListMediaAssetSearchConfigurationsController } from "../controller/dionysus/media/ListMediaAssetSearchConfigurations";
import { ListMediaAssetSearchExecutionsController } from "../controller/dionysus/media/ListMediaAssetSearchExecutions";
import { ListMediaAssetSearchResultsController } from "../controller/dionysus/media/ListMediaAssetSearchResults";
import { ListMediaAssetTranscodesController } from "../controller/dionysus/media/ListMediaAssetTranscodes";
import { ListMediaAssetWorkflowsController } from "../controller/dionysus/media/ListMediaAssetWorkflows";
import { TriggerMediaAssetSearchController } from "../controller/dionysus/media/TriggerMediaAssetSearch";
import { UpdateMediaAssetDownloadController } from "../controller/dionysus/media/UpdateMediaAssetDownload";
import { UpdateMediaAssetDownloadByNzbIdController } from "../controller/dionysus/media/UpdateMediaAssetDownloadByNzbId";
import { UpdateMediaAssetSearchConfigurationController } from "../controller/dionysus/media/UpdateMediaAssetSearchConfiguration";
import { UpdateMediaAssetSearchExecutionController } from "../controller/dionysus/media/UpdateMediaAssetSearchExecution";
import { UpdateMediaAssetWorkflowController } from "../controller/dionysus/media/UpdateMediaAssetWorkflow";
import { UpdateMediaAssetWorkflowStepController } from "../controller/dionysus/media/UpdateMediaAssetWorkflowStep";
import { VerifyMediaAssetTranscodeConfigurationController } from "../controller/dionysus/media/VerifyMediaAssetTranscodeConfiguration";
import { GetTvEpisodeByIdController } from "../controller/dionysus/metadata/tv/GetTvEpisodeById";

import { GraphQLClientModule } from "./GraphQLClientModule";
import { RabbitModule } from "./RabbitModule";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
    ApproveMediaAssetTranscodeConfigurationController,
    BulkUpdateMediaAssetDownloadsController,
    CreateMediaAssetController,
    CreateMediaAssetSearchConfigurationController,
    CreateMediaAssetSearchExecutionController,
    CreateMediaAssetSearchResultController,
    CreateMediaAssetDownloadController,
    CreateMediaAssetWorkflowController,
    CreateMediaAssetWorkflowStepController,
    CreateMediaAssetWorkflowSubStepController,
    CreateMediaFavoriteController,
    DeleteMediaFavoriteController,
    DeleteMediaAssetWorkflowController,
    GetTvEpisodeByIdController,
    GetMediaAssetSearchConfigurationsRunningCountController,
    DescribeMediaAssetSearchConfigurationController,
    DescribeMediaAssetSearchExecutionController,
    DescribeMediaAssetSearchResultController,
    DescribeMediaAssetWorkflowController,
    DescribeMediaAssetWorkflowStepController,
    ListMediaAssetDownloadsController,
    ListMediaAssetSearchConfigurationsController,
    ListMediaAssetSearchExecutionsController,
    ListMediaAssetSearchResultsController,
    ListMediaAssetTranscodesController,
    ListMediaAssetWorkflowsController,
    TriggerMediaAssetSearchController,
    UpdateMediaAssetDownloadController,
    UpdateMediaAssetDownloadByNzbIdController,
    UpdateMediaAssetSearchConfigurationController,
    UpdateMediaAssetSearchExecutionController,
    UpdateMediaAssetWorkflowController,
    UpdateMediaAssetWorkflowStepController,
    VerifyMediaAssetTranscodeConfigurationController,
  ],
})
export class MediaApiModule {}
