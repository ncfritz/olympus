import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ReporterModule } from "nestjs-metrics-reporter";
import { OlympusApiModule } from "./api/OlympusApiModule";
import { ALL_CONFIG, runtimeConfig } from "./config/configuration";
import type { RuntimeConfigType } from "./config/configuration";
import { FanoutModule } from "./fanout/FanoutModule";
import { MetricsContentTypeInterceptor } from "./infra/MetricsContentTypeInterceptor";
import { RabbitModule } from "./infra/RabbitModule";
import { SearchModule } from "./search/SearchModule";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `${process.env.NODE_ENV}.env`,
      isGlobal: true,
      // Typed namespaces (config/configuration.ts); each validates the
      // environment when first injected. main.ts validates it up front.
      load: ALL_CONFIG,
    }),
    ReporterModule.forRootAsync({
      inject: [runtimeConfig.KEY],
      useFactory: (runtime: RuntimeConfigType) => ({
        defaultMetricsEnabled: true,
        defaultLabels: {
          app: runtime.appName,
          environment: runtime.nodeEnv,
        },
      }),
    }),
    RabbitModule,
    OlympusApiModule,
    FanoutModule,
    SearchModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: MetricsContentTypeInterceptor },
  ],
})
export class AppModule {}
