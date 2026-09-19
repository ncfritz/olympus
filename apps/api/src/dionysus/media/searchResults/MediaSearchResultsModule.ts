import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateMediaAssetSearchResultController } from "./controllers/CreateMediaAssetSearchResultController";
import { DescribeMediaAssetSearchResultController } from "./controllers/DescribeMediaAssetSearchResultController";
import { ListMediaAssetSearchResultsController } from "./controllers/ListMediaAssetSearchResultsController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [
    CreateMediaAssetSearchResultController,
    DescribeMediaAssetSearchResultController,
    ListMediaAssetSearchResultsController,
  ],
})
export class MediaSearchResultsModule {}
