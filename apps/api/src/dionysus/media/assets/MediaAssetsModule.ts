import { Module } from "@nestjs/common";
import { MediaAssetService } from "./services/MediaAssetService";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateMediaAssetController } from "./controllers/CreateMediaAssetController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [MediaAssetService],
  controllers: [CreateMediaAssetController],
})
export class MediaAssetsModule {}
