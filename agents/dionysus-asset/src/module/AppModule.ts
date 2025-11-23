import { Logger, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ReporterModule } from "nestjs-metrics-reporter";
import { DeleteAssetHandler } from "../handler/deleteAssetHandler";
import { HlsGenerationAssetHandler } from "../handler/hlsGenerationHandler";
import { RawIngestionHandler } from "../handler/rawIngestionHandler";
import { ThumbnailGenerationAssetHandler } from "../handler/thumbnailGenerationHandler";
import { appName } from "../util/logger";
import { AxiosProxyModule } from "./AxiosProxyModule";
import { RabbitModule } from "./RabbitModule";

// Setup providers
// look for config.json
// if not found
//   load all providers
// else
//   for each provider
//     load add to providers list
//

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
    AxiosProxyModule,
    RabbitModule,
  ],
  exports: [],
  providers: [
    // Logging
    Logger,
    // Batch Jobs
    DeleteAssetHandler,
    HlsGenerationAssetHandler,
    ThumbnailGenerationAssetHandler,
    RawIngestionHandler,
  ],
  controllers: [],
})
export class AppModule implements NestModule {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  configure(consumer: MiddlewareConsumer) {}
}
