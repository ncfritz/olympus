import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateMediaAssetSearchExecutionController } from "./controllers/CreateMediaAssetSearchExecutionController";
import { DescribeMediaAssetSearchExecutionController } from "./controllers/DescribeMediaAssetSearchExecutionController";
import { ListMediaAssetSearchExecutionsController } from "./controllers/ListMediaAssetSearchExecutionsController";
import { UpdateMediaAssetSearchExecutionController } from "./controllers/UpdateMediaAssetSearchExecutionController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [
    CreateMediaAssetSearchExecutionController,
    DescribeMediaAssetSearchExecutionController,
    ListMediaAssetSearchExecutionsController,
    UpdateMediaAssetSearchExecutionController,
  ],
})
export class MediaSearchExecutionsModule {}
