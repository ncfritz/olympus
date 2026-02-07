import { Module } from "@nestjs/common";
import { CreateMediaAssetSearchConfigurationController } from "../controller/dionysus/media/CreateMediaAssetSearchConfiguration";
import { CreateMediaAssetSearchExecutionController } from "../controller/dionysus/media/CreateMediaAssetSearchExecution";
import { DescribeMediaAssetSearchConfigurationController } from "../controller/dionysus/media/DescribeMediaAssetSearchConfiguration";
import { DescribeMediaAssetSearchExecutionController } from "../controller/dionysus/media/DescribeMediaAssetSearchExecution";
import { ListMediaSearchExecutionsController } from "../controller/dionysus/media/ListMediaAssetSearchExecutions";
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
    DescribeMediaAssetSearchConfigurationController,
    DescribeMediaAssetSearchExecutionController,
    ListMediaSearchExecutionsController,
    TriggerMediaAssetSearchController,
    UpdateMediaAssetSearchConfigurationController,
    UpdateMediaAssetSearchExecutionController,
  ],
})
export class MediaApiModule {}
