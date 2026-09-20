import { MetricsModule } from "@ncfritz/olympus-nest";
import { OlympusClientModule } from "@ncfritz/olympus-client/nest";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BatchModule } from "./batch/BatchModule";
import type {
  RuntimeConfigType,
  OlympusConfigType,
} from "./config/configuration";
import {
  ALL_CONFIG,
  runtimeConfig,
  olympusConfig,
} from "./config/configuration";
import { EntitiesModule } from "./entities/EntitiesModule";
import { FetchJobsModule } from "./fetchJobs/FetchJobsModule";
import { RabbitModule } from "./infra/RabbitModule";
import { TmdbModule } from "./tmdb/TmdbModule";
import { WorkflowModule } from "./workflow/WorkflowModule";

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
    // The Olympus API, through @ncfritz/olympus-client (ADR 0017)
    OlympusClientModule.forRootAsync({
      inject: [olympusConfig.KEY, runtimeConfig.KEY],
      useFactory: (olympus: OlympusConfigType, runtime: RuntimeConfigType) => ({
        baseUrl: olympus.baseUrl,
        clientName: runtime.appName,
        tls: olympus.tls,
      }),
    }),
    TmdbModule,
    FetchJobsModule,
    WorkflowModule,
    BatchModule,
    EntitiesModule,
  ],
})
export class AppModule {}
