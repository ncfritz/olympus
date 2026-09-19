import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR, RouterModule } from "@nestjs/core";
import { ReporterModule } from "nestjs-metrics-reporter";
import {
  ALL_CONFIG,
  serverConfig,
  ServerConfigType,
} from "./config/configuration";
import { DIONYSUS_MODULES, DionysusModule } from "./dionysus/DionysusModule";
import { GraphQLClientModule } from "./infra/GraphQLClientModule";
import { PrometheusMetricsInterceptor } from "./infra/PrometheusOperationMetricsInterceptor";
import { RabbitModule } from "./infra/RabbitModule";
import { MINERVA_MODULES, MinervaModule } from "./minerva/MinervaModule";
import { OLYMPUS_MODULES, OlympusModule } from "./olympus/OlympusModule";
import { NotificationsGatewayModule } from "./olympus/notifications/gateway/NotificationsGatewayModule";
import { Routes } from "./utils/routes";

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
      inject: [serverConfig.KEY],
      useFactory: (server: ServerConfigType) => ({
        defaultMetricsEnabled: true,
        defaultLabels: {
          app: server.appName,
          environment: server.nodeEnv,
        },
      }),
    }),
    // Each domain's feature modules are served under its prefix.
    RouterModule.register([
      {
        path: Routes.OLYMPUS,
        module: OlympusModule,
        children: OLYMPUS_MODULES,
      },
      {
        path: Routes.DIONYSUS,
        module: DionysusModule,
        children: DIONYSUS_MODULES,
      },
      {
        path: Routes.MINERVA,
        module: MinervaModule,
        children: MINERVA_MODULES,
      },
    ]),
    // Infrastructure modules
    RabbitModule,
    GraphQLClientModule,
    NotificationsGatewayModule,
    // Domains
    OlympusModule,
    DionysusModule,
    MinervaModule,
  ],
  providers: [
    // Request metrics for every operation.
    { provide: APP_INTERCEPTOR, useClass: PrometheusMetricsInterceptor },
  ],
})
export class AppModule {}
