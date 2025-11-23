import { Module } from "@nestjs/common";
import { AddContentAssetTagToAssetController } from "../controller/dionysus/content/tags/AddContentAssetTagToAsset";
import { CheckAuthController } from "../controller/dionysus/content/auth/CheckAuthController";
import { CreateContentAssetController } from "../controller/dionysus/content/CreateContentAsset";
import { CreateContentAssetTagController } from "../controller/dionysus/content/tags/CreateContentAssetTag";
import { CreateContentJobController } from "../controller/dionysus/content/CreateContentJob";
import { DeleteContentAssetTagFromAssetController } from "../controller/dionysus/content/tags/DeleteContentAssetTagFromAsset";
import { GenerateAuthKeyController } from "../controller/dionysus/content/GenerateAuthKeyController";
import { GetContentAssetController } from "../controller/dionysus/content/GetContentAsset";
import { GetContentAssetAggregateStatisticsController } from "../controller/dionysus/content/GetContentAssetAggregateStatistics";
import { GetContentAssetDurationStatisticsController } from "../controller/dionysus/content/GetContentAssetDurationStatistics";
import { GetContentAssetHeightStatisticsController } from "../controller/dionysus/content/GetContentAssetHeightStatistics";
import { GetContentAssetSizeStatisticsController } from "../controller/dionysus/content/GetContentAssetSizeStatistics";
import { GetContentAssetWidthStatisticsController } from "../controller/dionysus/content/GetContentAssetWidthStatistics";
import { GetUntaggedContentAssetController } from "../controller/dionysus/content/GetUntaggedContentAsset";
import { ListAvailableContentAssetTagsController } from "../controller/dionysus/content/tags/ListAvailableContentAssetTags";
import { ListContentAssetsController } from "../controller/dionysus/content/ListContentAssets";
import { ListContentAssetTagsForAssetController } from "../controller/dionysus/content/tags/ListContentAssetTagsForAsset";
import { ListDuplicateContentAssetsController } from "../controller/dionysus/content/ListDuplicateContentAssets";
import { ListSimilarContentAssetsController } from "../controller/dionysus/content/ListSimilarContentAssets";
import { SetContentAssetRatingController } from "../controller/dionysus/content/SetContentAssetRating";
import { CreateContentIngestionWorkflowController } from "../controller/dionysus/content/workflow/CreateContentIngestionWorkflow";
import { CreateContentIngestionWorkflowStepController } from "../controller/dionysus/content/workflow/CreateContentIngestionWorkflowStep";
import { DescribeContentIngestionWorkflowController } from "../controller/dionysus/content/workflow/DescribeContentIngestionWorkflow";
import { ListContentIngestionWorkflowsController } from "../controller/dionysus/content/workflow/ListContentIngestionWorkflows";
import { UpdateContentIngestionWorkflowController } from "../controller/dionysus/content/workflow/UpdateContentIngestionWorkflow";
import { UpdateContentIngestionWorkflowStepController } from "../controller/dionysus/content/workflow/UpdateContentIngestionWorkflowStep";
import { UploadAssetsController } from "../controller/dionysus/content/workflow/UploadAssets";
import { VerifyAuthCodeController } from "../controller/dionysus/content/auth/VerifyAuthCodeController";

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
    CreateContentIngestionWorkflowController,
    CreateContentIngestionWorkflowStepController,
    CreateContentJobController,
    DeleteContentAssetTagFromAssetController,
    DescribeContentIngestionWorkflowController,
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
    ListContentIngestionWorkflowsController,
    ListDuplicateContentAssetsController,
    ListSimilarContentAssetsController,
    SetContentAssetRatingController,
    UpdateContentIngestionWorkflowController,
    UpdateContentIngestionWorkflowStepController,
    UploadAssetsController,
    VerifyAuthCodeController,
  ],
})
export class ContentApiModule {}
