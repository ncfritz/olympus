import { Module } from "@nestjs/common";
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
import { UpdateMediaAssetSearchConfigurationController } from "../controller/dionysus/media/UpdateMediaAssetSearchConfiguration";
import { UpdateMediaAssetSearchExecutionController } from "../controller/dionysus/media/UpdateMediaAssetSearchExecution";

import { GraphQLClientModule } from "./GraphQLClientModule";
import { RabbitModule } from "./RabbitModule";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
    CreateMediaAssetSearchConfigurationController,
    CreateMediaAssetSearchExecutionController,
    CreateMediaAssetSearchResultController,
    GetMediaAssetSearchConfigurationsRunningCountController,
    DescribeMediaAssetSearchConfigurationController,
    DescribeMediaAssetSearchExecutionController,
    DescribeMediaAssetSearchResultController,
    ListMediaSearchExecutionsController,
    ListMediaAssetSearchResultsController,
    TriggerMediaAssetSearchController,
    UpdateMediaAssetSearchConfigurationController,
    UpdateMediaAssetSearchExecutionController,
  ],
})
export class MediaApiModule {}
