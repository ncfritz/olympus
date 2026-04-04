import { Module } from "@nestjs/common";
import { BulkUpdateMediaAssetDownloadsController } from "../controller/dionysus/media/BulkUpdateMediaAssetDownloads";
import { CreateMediaAssetController } from "../controller/dionysus/media/CreateMediaAsset";
import { CreateMediaAssetDownloadController } from "../controller/dionysus/media/CreateMediaAssetDownload";
import { CreateMediaAssetSearchConfigurationController } from "../controller/dionysus/media/CreateMediaAssetSearchConfiguration";
import { CreateMediaAssetSearchExecutionController } from "../controller/dionysus/media/CreateMediaAssetSearchExecution";
import { CreateMediaAssetSearchResultController } from "../controller/dionysus/media/CreateMediaAssetSearchResult";
import { DescribeMediaAssetSearchConfigurationController } from "../controller/dionysus/media/DescribeMediaAssetSearchConfiguration";
import { DescribeMediaAssetSearchExecutionController } from "../controller/dionysus/media/DescribeMediaAssetSearchExecution";
import { DescribeMediaAssetSearchResultController } from "../controller/dionysus/media/DescribeMediaAssetSearchResult";
import { GetMediaAssetSearchConfigurationsRunningCountController } from "../controller/dionysus/media/GetMediaAssetSearchConfigurationsRunningCount";
import { ListMediaSearchExecutionsController } from "../controller/dionysus/media/ListMediaAssetSearchExecutions";
import { ListMediaAssetSearchResultsController } from "../controller/dionysus/media/ListMediaAssetSearchResults";
import { TriggerMediaAssetSearchController } from "../controller/dionysus/media/TriggerMediaAssetSearch";
import { UpdateMediaAssetDownloadController } from "../controller/dionysus/media/UpdateMediaAssetDownload";
import { UpdateMediaAssetDownloadByNzbIdController } from "../controller/dionysus/media/UpdateMediaAssetDownloadByNzbId";
import { UpdateMediaAssetSearchConfigurationController } from "../controller/dionysus/media/UpdateMediaAssetSearchConfiguration";
import { UpdateMediaAssetSearchExecutionController } from "../controller/dionysus/media/UpdateMediaAssetSearchExecution";

import { GraphQLClientModule } from "./GraphQLClientModule";
import { RabbitModule } from "./RabbitModule";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
    BulkUpdateMediaAssetDownloadsController,
    CreateMediaAssetController,
    CreateMediaAssetSearchConfigurationController,
    CreateMediaAssetSearchExecutionController,
    CreateMediaAssetSearchResultController,
    CreateMediaAssetDownloadController,
    GetMediaAssetSearchConfigurationsRunningCountController,
    DescribeMediaAssetSearchConfigurationController,
    DescribeMediaAssetSearchExecutionController,
    DescribeMediaAssetSearchResultController,
    ListMediaSearchExecutionsController,
    ListMediaAssetSearchResultsController,
    TriggerMediaAssetSearchController,
    UpdateMediaAssetDownloadController,
    UpdateMediaAssetDownloadByNzbIdController,
    UpdateMediaAssetSearchConfigurationController,
    UpdateMediaAssetSearchExecutionController,
  ],
})
export class MediaApiModule {}
