import { Module } from "@nestjs/common";
import { AddContentAssetTagToAssetController } from "../controller/content/AddContentAssetTagToAsset";
import { CheckAuthController } from "../controller/content/CheckAuthController";
import { CreateContentAssetTagController } from "../controller/content/CreateContentAssetTag";
import { CreateContentJobController } from "../controller/content/CreateContentJob";
import { GenerateAuthKeyController } from "../controller/content/GenerateAuthKeyController";
import { CreateContentAssetController } from "../controller/content/CreateContentAsset";
import { DeleteContentAssetTagFromAssetController } from "../controller/content/DeleteContentAssetTagFromAsset";
import { GetContentAssetController } from "../controller/content/GetContentAsset";
import { GetContentAssetAggregateStatisticsController } from "../controller/content/GetContentAssetAggregateStatistics";
import { GetContentAssetDurationStatisticsController } from "../controller/content/GetContentAssetDurationStatistics";
import { GetContentAssetHeightStatisticsController } from "../controller/content/GetContentAssetHeightStatistics";
import { GetContentAssetSizeStatisticsController } from "../controller/content/GetContentAssetSizeStatistics";
import { GetContentAssetWidthStatisticsController } from "../controller/content/GetContentAssetWidthStatistics";
import { GetUntaggedContentAssetController } from "../controller/content/GetUntaggedContentAsset";
import { ListContentAssetsController } from "../controller/content/ListContentAssets";
import { ListAvailableContentAssetTagsController } from "../controller/content/ListAvailableContentAssetTags";
import { ListContentAssetTagsForAssetController } from "../controller/content/ListContentAssetTagsForAsset";
import { ListDuplicateContentAssetsController } from "../controller/content/ListDuplicateContentAssets";
import { ListSimilarContentAssetsController } from "../controller/content/ListSimilarContentAssets";
import { SetContentAssetRatingController } from "../controller/content/SetContentAssetRating";
import { UploadAssetsController } from "../controller/content/UploadAssets";
import { VerifyAuthCodeController } from "../controller/content/VerifyAuthCodeController";
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
