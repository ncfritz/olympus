import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { MediaAssetSearchConfigurationService } from "./services/MediaAssetSearchConfigurationService";
import { CreateMediaAssetSearchConfigurationController } from "./controllers/CreateMediaAssetSearchConfigurationController";
import { DescribeMediaAssetSearchConfigurationController } from "./controllers/DescribeMediaAssetSearchConfigurationController";
import { GetMediaAssetSearchConfigurationsRunningCountController } from "./controllers/GetMediaAssetSearchConfigurationsRunningCountController";
import { ListMediaAssetSearchConfigurationsController } from "./controllers/ListMediaAssetSearchConfigurationsController";
import { TriggerMediaAssetSearchController } from "./controllers/TriggerMediaAssetSearchController";
import { UpdateMediaAssetSearchConfigurationController } from "./controllers/UpdateMediaAssetSearchConfigurationController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [MediaAssetSearchConfigurationService],
  exports: [MediaAssetSearchConfigurationService],
  controllers: [
    CreateMediaAssetSearchConfigurationController,
    DescribeMediaAssetSearchConfigurationController,
    GetMediaAssetSearchConfigurationsRunningCountController,
    ListMediaAssetSearchConfigurationsController,
    TriggerMediaAssetSearchController,
    UpdateMediaAssetSearchConfigurationController,
  ],
})
export class MediaSearchConfigurationsModule {}
