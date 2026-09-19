import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { ContentAuthModule } from "../auth/ContentAuthModule";
import { ContentAssetService } from "./services/ContentAssetService";
import { CreateContentAssetController } from "./controllers/CreateContentAssetController";
import { CreateContentJobController } from "./controllers/CreateContentJobController";
import { GetContentAssetAggregateStatisticsController } from "./controllers/GetContentAssetAggregateStatisticsController";
import { GetContentAssetController } from "./controllers/GetContentAssetController";
import { GetContentAssetDurationStatisticsController } from "./controllers/GetContentAssetDurationStatisticsController";
import { GetContentAssetHeightStatisticsController } from "./controllers/GetContentAssetHeightStatisticsController";
import { GetContentAssetSizeStatisticsController } from "./controllers/GetContentAssetSizeStatisticsController";
import { GetContentAssetWidthStatisticsController } from "./controllers/GetContentAssetWidthStatisticsController";
import { GetUntaggedContentAssetController } from "./controllers/GetUntaggedContentAssetController";
import { ListContentAssetsController } from "./controllers/ListContentAssetsController";
import { ListDuplicateContentAssetsController } from "./controllers/ListDuplicateContentAssetsController";
import { ListSimilarContentAssetsController } from "./controllers/ListSimilarContentAssetsController";
import { SetContentAssetRatingController } from "./controllers/SetContentAssetRatingController";

@Module({
  imports: [RabbitModule, GraphQLClientModule, ContentAuthModule],
  providers: [ContentAssetService],
  controllers: [
    CreateContentAssetController,
    CreateContentJobController,
    GetContentAssetAggregateStatisticsController,
    GetContentAssetController,
    GetContentAssetDurationStatisticsController,
    GetContentAssetHeightStatisticsController,
    GetContentAssetSizeStatisticsController,
    GetContentAssetWidthStatisticsController,
    GetUntaggedContentAssetController,
    ListContentAssetsController,
    ListDuplicateContentAssetsController,
    ListSimilarContentAssetsController,
    SetContentAssetRatingController,
  ],
})
export class ContentAssetsModule {}
