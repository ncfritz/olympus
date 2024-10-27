import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DeleteAssetHandler } from "../handler/deleteAssetHandler";
import { HlsGenerationAssetHandler } from "../handler/hlsGenerationHandler";
import { RawIngestionHandler } from "../handler/rawIngestionHandler";
import { ThumbnailGenerationAssetHandler } from "../handler/thumbnailGenerationHandler";
import { GraphQLClientModule } from "./GraphQLClientModule";
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
    RabbitModule,
    GraphQLClientModule,
  ],
  exports: [],
  providers: [
    // Batch Jobs
    DeleteAssetHandler,
    HlsGenerationAssetHandler,
    ThumbnailGenerationAssetHandler,
    RawIngestionHandler,
  ],
  controllers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {}
}
