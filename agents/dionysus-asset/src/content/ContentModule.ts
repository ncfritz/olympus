import { DynamicModule, Module, Type } from "@nestjs/common";
import { ProxyHttpModule } from "../infra/ProxyHttpModule";
import { DeleteAssetHandler } from "./handlers/DeleteAssetHandler";
import { HlsGenerationHandler } from "./handlers/HlsGenerationHandler";
import { RawIngestionHandler } from "./handlers/RawIngestionHandler";
import { ThumbnailGenerationHandler } from "./handlers/ThumbnailGenerationHandler";
import { AssetWorkflows } from "./services/AssetWorkflows";
import { ContentReporter } from "./services/ContentReporter";

/** The content handlers, by their DISABLE_ switch. */
export const CONTENT_HANDLERS = {
  DISABLE_CONTENT_DELETION_HANDLER: DeleteAssetHandler,
  DISABLE_CONTENT_HLS_HANDLER: HlsGenerationHandler,
  DISABLE_CONTENT_THUMBNAIL_HANDLER: ThumbnailGenerationHandler,
  DISABLE_CONTENT_RAW_INGESTION_HANDLER: RawIngestionHandler,
};

/** Content assets: ingestion, HLS, thumbnails. */
@Module({})
export class ContentModule {
  /** @param handlers the enabled CONTENT_HANDLERS */
  static register(handlers: Type[]): DynamicModule {
    return {
      module: ContentModule,
      imports: [ProxyHttpModule],
      providers: [AssetWorkflows, ContentReporter, ...handlers],
    };
  }
}
