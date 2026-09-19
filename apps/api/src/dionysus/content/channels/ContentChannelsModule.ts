import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { ContentAuthModule } from "../auth/ContentAuthModule";
import { ContentAssetChannelCategoryService } from "./services/ContentAssetChannelCategoryService";
import { ContentAssetChannelService } from "./services/ContentAssetChannelService";
import { CreateContentAssetChannelCategoryController } from "./controllers/CreateContentAssetChannelCategoryController";
import { CreateContentAssetChannelController } from "./controllers/CreateContentAssetChannelController";
import { DeleteContentAssetChannelController } from "./controllers/DeleteContentAssetChannelController";
import { DescribeContentAssetChannelCategoryController } from "./controllers/DescribeContentAssetChannelCategoryController";
import { DescribeContentAssetChannelController } from "./controllers/DescribeContentAssetChannelController";
import { FavoriteContentAssetChannelController } from "./controllers/FavoriteContentAssetChannelController";
import { ListContentAssetChannelCategoriesController } from "./controllers/ListContentAssetChannelCategoriesController";
import { ListContentAssetChannelsController } from "./controllers/ListContentAssetChannelsController";
import { ListContentAssetChannelsForCategoryController } from "./controllers/ListContentAssetChannelsForCategoryController";
import { RefreshContentAssetChannelController } from "./controllers/RefreshContentAssetChannelController";
import { UpdateContentAssetChannelCategoryController } from "./controllers/UpdateContentAssetChannelCategoryController";
import { UpdateContentAssetChannelController } from "./controllers/UpdateContentAssetChannelController";

@Module({
  imports: [RabbitModule, GraphQLClientModule, ContentAuthModule],
  providers: [ContentAssetChannelService, ContentAssetChannelCategoryService],
  controllers: [
    CreateContentAssetChannelCategoryController,
    CreateContentAssetChannelController,
    DeleteContentAssetChannelController,
    DescribeContentAssetChannelCategoryController,
    DescribeContentAssetChannelController,
    FavoriteContentAssetChannelController,
    ListContentAssetChannelCategoriesController,
    ListContentAssetChannelsController,
    ListContentAssetChannelsForCategoryController,
    RefreshContentAssetChannelController,
    UpdateContentAssetChannelCategoryController,
    UpdateContentAssetChannelController,
  ],
})
export class ContentChannelsModule {}
