import { Module } from "@nestjs/common";
import { AddContentAssetTagToAssetController } from "../controller/dionysus/content/AddContentAssetTagToAsset";
import { CheckAuthController } from "../controller/dionysus/content/CheckAuthController";
import { CreateContentAssetController } from "../controller/dionysus/content/CreateContentAsset";
import { CreateContentAssetTagController } from "../controller/dionysus/content/CreateContentAssetTag";
import { CreateContentJobController } from "../controller/dionysus/content/CreateContentJob";
import { DeleteContentAssetTagFromAssetController } from "../controller/dionysus/content/DeleteContentAssetTagFromAsset";
import { GenerateAuthKeyController } from "../controller/dionysus/content/GenerateAuthKeyController";
import { GetContentAssetController } from "../controller/dionysus/content/GetContentAsset";
import { GetContentAssetAggregateStatisticsController } from "../controller/dionysus/content/GetContentAssetAggregateStatistics";
import { GetContentAssetDurationStatisticsController } from "../controller/dionysus/content/GetContentAssetDurationStatistics";
import { GetContentAssetHeightStatisticsController } from "../controller/dionysus/content/GetContentAssetHeightStatistics";
import { GetContentAssetSizeStatisticsController } from "../controller/dionysus/content/GetContentAssetSizeStatistics";
import { GetContentAssetWidthStatisticsController } from "../controller/dionysus/content/GetContentAssetWidthStatistics";
import { GetUntaggedContentAssetController } from "../controller/dionysus/content/GetUntaggedContentAsset";
import { ListAvailableContentAssetTagsController } from "../controller/dionysus/content/ListAvailableContentAssetTags";
import { ListContentAssetsController } from "../controller/dionysus/content/ListContentAssets";
import { ListContentAssetTagsForAssetController } from "../controller/dionysus/content/ListContentAssetTagsForAsset";
import { ListDuplicateContentAssetsController } from "../controller/dionysus/content/ListDuplicateContentAssets";
import { ListSimilarContentAssetsController } from "../controller/dionysus/content/ListSimilarContentAssets";
import { SetContentAssetRatingController } from "../controller/dionysus/content/SetContentAssetRating";
import { UploadAssetsController } from "../controller/dionysus/content/UploadAssets";
import { VerifyAuthCodeController } from "../controller/dionysus/content/VerifyAuthCodeController";

import { GraphQLClientModule } from "./GraphQLClientModule";
import { RabbitModule } from "./RabbitModule";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
    AddContentAssetTagToAssetController,
    GenerateAuthKeyController,
    CheckAuthController,
    CreateContentAssetController,
    CreateContentAssetTagController,
    CreateContentJobController,
    DeleteContentAssetTagFromAssetController,
    GetContentAssetController,
    GetContentAssetAggregateStatisticsController,
    GetContentAssetDurationStatisticsController,
    GetContentAssetHeightStatisticsController,
    GetContentAssetSizeStatisticsController,
    GetContentAssetWidthStatisticsController,
    GetUntaggedContentAssetController,
    ListAvailableContentAssetTagsController,
    ListContentAssetsController,
    ListContentAssetTagsForAssetController,
    ListDuplicateContentAssetsController,
    ListSimilarContentAssetsController,
    SetContentAssetRatingController,
    UploadAssetsController,
    VerifyAuthCodeController,
  ],
})
export class ContentApiModule {}
