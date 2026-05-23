import { Logger, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ReporterModule } from "nestjs-metrics-reporter";
import { DeleteAssetHandler } from "../handler/content/deleteAssetHandler";
import { HlsGenerationAssetHandler } from "../handler/content/hlsGenerationHandler";
import { DownloadStatusHandler } from "../handler/download/DownloadStatusHandler";
import { DownloadUpdateHandler } from "../handler/download/DownloadUpdateHandler";
import { StartDownloadHandler } from "../handler/download/StartDownloadHandler";
import { TranscodeCleanupHandler } from "../handler/media/cleanupHandler";
import { ConfigureTranscodeHandler } from "../handler/media/configureTranscodeHandler";
import { MetadataExtractionHandler } from "../handler/media/metadataExtractionHandler";
import { RawIngestionHandler } from "../handler/content/rawIngestionHandler";
import { ThumbnailGenerationAssetHandler } from "../handler/content/thumbnailGenerationHandler";
import { TestHandler } from "../handler/media/testHandler";
import { TranscodeConfigurationHandler } from "../handler/media/transcodeConfigurationHandler";
import { TranscodeMediaHandler } from "../handler/media/transcodeMediaHandler";
import { VerifyTranscodeConfigurationHandler } from "../handler/media/verifyTranscodeConfigurationHandler";
import { appName, logger } from "../util/logger";
import { AxiosProxyModule } from "./AxiosProxyModule";
import { RabbitModule } from "./RabbitModule";

const HANDLER_MAP = {
  // Content Asset Jobs
  DISABLE_CONTENT_DELETION_HANDLER: DeleteAssetHandler,
  DISABLE_CONTENT_HLS_HANDLER: HlsGenerationAssetHandler,
  DISABLE_CONTENT_THUMBNAIL_HANDLER: ThumbnailGenerationAssetHandler,
  DISABLE_CONTENT_RAW_INGESTION_HANDLER: RawIngestionHandler,
  // Media Asset Jobs
  DISABLE_DIONYSUS_METADATA_HANDLER: MetadataExtractionHandler,
  DISABLE_DIONYSUS_XCODE_PRE_CONFIGURATION_HANDLER: ConfigureTranscodeHandler,
  DISABLE_DIONYSUS_XCODE_CONFIGURATION_HANDLER: TranscodeConfigurationHandler,
  DISABLE_DIONYSUS_XCODE_HANDLER: TranscodeMediaHandler,
  DISABLE_DIONYSUS_VERIFY_XCODE_HANDLER: VerifyTranscodeConfigurationHandler,
  DISABLE_DIONYSUS_CLEANUP_HANDLER: TranscodeCleanupHandler,
  // Download Jobs
  DISABLE_DIONYSUS_START_DOWNLOAD_HANDLER: StartDownloadHandler,
  DISABLE_DIONYSUS_DOWNLOAD_UPDATE_HANDLER: DownloadUpdateHandler,
  // Status Jobs
  DISABLE_DIONYSUS_DOWNLOAD_STATUS_HANDLER: DownloadStatusHandler,
  // Test - DELETE ME!!!
  DISABLE_TEST_HANDLER: TestHandler,
};

const enabledHandlers = Object.entries(HANDLER_MAP)
  .filter(([key, handler]) => {
    if (process.env[key] !== "true") {
      return true;
    }

    logger.warn(
      `Handler ${handler.name} is disabled per environment variable ${key} - set to 'false' to enable`,
    );
    return false;
  })
  .map(([key, handler]) => handler);

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `${process.env.NODE_ENV}.env`,
      isGlobal: true,
    }),
    ReporterModule.forRootAsync({
      useFactory: () => ({
        defaultMetricsEnabled: true,
        defaultLabels: {
          app: appName,
          environment: process.env.NODE_ENV!,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    AxiosProxyModule,
    RabbitModule,
  ],
  exports: [],
  providers: [
    // Logging
    Logger,
    ...enabledHandlers,
  ],
  controllers: [],
})
export class AppModule implements NestModule {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  configure(consumer: MiddlewareConsumer) {}
}
