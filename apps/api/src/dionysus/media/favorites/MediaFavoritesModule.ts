import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateMediaFavoriteController } from "./controllers/CreateMediaFavoriteController";
import { DeleteMediaFavoriteController } from "./controllers/DeleteMediaFavoriteController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [CreateMediaFavoriteController, DeleteMediaFavoriteController],
})
export class MediaFavoritesModule {}
