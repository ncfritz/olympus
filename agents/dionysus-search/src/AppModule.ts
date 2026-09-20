import { MetricsModule } from "@ncfritz/olympus-nest";
import { OlympusClientModule } from "@ncfritz/olympus-client/nest";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
  ALL_CONFIG,
  runtimeConfig,
  olympusConfig,
} from "./config/configuration";
import type {
  RuntimeConfigType,
  OlympusConfigType,
} from "./config/configuration";
import { FanoutModule } from "./fanout/FanoutModule";
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
    FanoutModule,
    SearchModule,
  ],
})
export class AppModule {}
