import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { MediaSearchConfigurationsModule } from "../searchConfigurations/MediaSearchConfigurationsModule";
import { MediaAssetSearchResultService } from "./services/MediaAssetSearchResultService";
import { CreateMediaAssetSearchResultController } from "./controllers/CreateMediaAssetSearchResultController";
import { DescribeMediaAssetSearchResultController } from "./controllers/DescribeMediaAssetSearchResultController";
import { ListMediaAssetSearchResultsController } from "./controllers/ListMediaAssetSearchResultsController";

@Module({
  imports: [RabbitModule, GraphQLClientModule, MediaSearchConfigurationsModule],
  providers: [MediaAssetSearchResultService],
  exports: [MediaAssetSearchResultService],
  controllers: [
    CreateMediaAssetSearchResultController,
    DescribeMediaAssetSearchResultController,
    ListMediaAssetSearchResultsController,
  ],
})
export class MediaSearchResultsModule {}
