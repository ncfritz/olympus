import { MetricsModule } from "@ncfritz/olympus-nest";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ALL_CONFIG, runtimeConfig } from "./config/configuration";
import type { RuntimeConfigType } from "./config/configuration";

/**
 * Phase 0 of docs/plans/email-management: configuration and /metrics.
 * The Takeout source, the broker and the API client arrive with phase 1a.
 */
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
  ],
})
export class AppModule {}
