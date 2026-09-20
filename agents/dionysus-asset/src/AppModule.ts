import { MetricsModule } from "@ncfritz/olympus-nest";
import { Logger, Module, Type } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OlympusApiModule } from "./api/OlympusApiModule";
import { ALL_CONFIG, runtimeConfig } from "./config/configuration";
import type { RuntimeConfigType } from "./config/configuration";
import { CONTENT_HANDLERS, ContentModule } from "./content/ContentModule";
import {
  DOWNLOAD_HANDLERS,
  DownloadsModule,
} from "./downloads/DownloadsModule";
import { RabbitModule } from "./infra/RabbitModule";
import { MEDIA_HANDLERS, MediaModule } from "./media/MediaModule";
import { ToolsModule } from "./tools/ToolsModule";

const logger = new Logger("AppModule");

/**
 * The handlers not switched off: every handler runs unless its
 * DISABLE_<HANDLER> environment variable is "true".
 */
const enabled = (handlers: Record<string, Type>): Type[] =>
  Object.entries(handlers)
    .filter(([key, handler]) => {
      if (process.env[key] !== "true") {
        logger.log(
          `Handler ${handler.name} is enabled per environment variable ${key}`,
        );
        return true;
      }

      logger.warn(
        `Handler ${handler.name} is disabled per environment variable ${key} - set to 'false' to enable`,
      );
      return false;
    })
    .map(([, handler]) => handler);

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `${process.env.NODE_ENV}.env`,
      isGlobal: true,
      // Typed namespaces (config/configuration.ts); each validates the
      // environment when first injected. main.ts validates it up front.
      load: ALL_CONFIG,
    }),
    // /metrics (ADR 0017)
    MetricsModule.forRootAsync({
      inject: [runtimeConfig.KEY],
      useFactory: (runtime: RuntimeConfigType) => ({
        app: runtime.appName,
        environment: runtime.nodeEnv,
      }),
    }),
    RabbitModule,
    OlympusApiModule,
    ToolsModule,
    ContentModule.register(enabled(CONTENT_HANDLERS)),
    MediaModule.register(enabled(MEDIA_HANDLERS)),
    DownloadsModule.register(enabled(DOWNLOAD_HANDLERS)),
  ],
})
export class AppModule {}
