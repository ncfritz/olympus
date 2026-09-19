import { Module } from "@nestjs/common";
import { MediaSearchResultsModule } from "../searchResults/MediaSearchResultsModule";
import { MediaAssetDownloadService } from "./services/MediaAssetDownloadService";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { BulkUpdateMediaAssetDownloadsController } from "./controllers/BulkUpdateMediaAssetDownloadsController";
import { CreateMediaAssetDownloadController } from "./controllers/CreateMediaAssetDownloadController";
import { ListMediaAssetDownloadsController } from "./controllers/ListMediaAssetDownloadsController";
import { UpdateMediaAssetDownloadByNzbIdController } from "./controllers/UpdateMediaAssetDownloadByNzbIdController";
import { UpdateMediaAssetDownloadController } from "./controllers/UpdateMediaAssetDownloadController";

@Module({
  imports: [RabbitModule, GraphQLClientModule, MediaSearchResultsModule],
  providers: [MediaAssetDownloadService],
  controllers: [
    BulkUpdateMediaAssetDownloadsController,
    CreateMediaAssetDownloadController,
    ListMediaAssetDownloadsController,
    UpdateMediaAssetDownloadByNzbIdController,
    UpdateMediaAssetDownloadController,
  ],
})
export class MediaDownloadsModule {}
