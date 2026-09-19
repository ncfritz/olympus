import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateMediaAssetController } from "./controllers/CreateMediaAssetController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [CreateMediaAssetController],
})
export class MediaAssetsModule {}
