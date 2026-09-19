import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { MediaSearchConfigurationsModule } from "../searchConfigurations/MediaSearchConfigurationsModule";
import { MediaAssetSearchExecutionService } from "./services/MediaAssetSearchExecutionService";
import { CreateMediaAssetSearchExecutionController } from "./controllers/CreateMediaAssetSearchExecutionController";
import { DescribeMediaAssetSearchExecutionController } from "./controllers/DescribeMediaAssetSearchExecutionController";
import { ListMediaAssetSearchExecutionsController } from "./controllers/ListMediaAssetSearchExecutionsController";
import { UpdateMediaAssetSearchExecutionController } from "./controllers/UpdateMediaAssetSearchExecutionController";

@Module({
  imports: [RabbitModule, GraphQLClientModule, MediaSearchConfigurationsModule],
  providers: [MediaAssetSearchExecutionService],
  controllers: [
    CreateMediaAssetSearchExecutionController,
    DescribeMediaAssetSearchExecutionController,
    ListMediaAssetSearchExecutionsController,
    UpdateMediaAssetSearchExecutionController,
  ],
})
export class MediaSearchExecutionsModule {}
