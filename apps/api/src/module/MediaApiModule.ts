import { Module } from "@nestjs/common";
import { CreateMediaAssetSearchConfigurationController } from "../controller/dionysus/media/CreateMediaAssetSearchConfiguration";
import { DescribeMediaAssetSearchConfigurationController } from "../controller/dionysus/media/DescribeMediaAssetSearchConfiguration";
import { UpdateMediaAssetSearchConfigurationController } from "../controller/dionysus/media/UpdateMediaAssetSearchConfiguration";

import { GraphQLClientModule } from "./GraphQLClientModule";
import { RabbitModule } from "./RabbitModule";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
    CreateMediaAssetSearchConfigurationController,
    DescribeMediaAssetSearchConfigurationController,
    UpdateMediaAssetSearchConfigurationController,
  ],
})
export class MediaApiModule {}
