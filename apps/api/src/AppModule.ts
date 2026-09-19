import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RouterModule } from "@nestjs/core";
import { ReporterModule } from "nestjs-metrics-reporter";
import { DIONYSUS_MODULES, DionysusModule } from "./dionysus/DionysusModule";
import { GraphQLClientModule } from "./infra/GraphQLClientModule";
import { RabbitModule } from "./infra/RabbitModule";
import { MINERVA_MODULES, MinervaModule } from "./minerva/MinervaModule";
import { OLYMPUS_MODULES, OlympusModule } from "./olympus/OlympusModule";
import { NotificationsGatewayModule } from "./olympus/notifications/gateway/NotificationsGatewayModule";
import { appName } from "./utils/logger";
import { Routes } from "./utils/routes";

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
})
export class AppModule {}
