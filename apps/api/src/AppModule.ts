import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RouterModule } from "@nestjs/core";
import {
  HealthController,
  MetricsController,
  MetricsModule,
} from "@ncfritz/olympus-nest";
import {
  ALL_CONFIG,
  serverConfig,
  ServerConfigType,
} from "./config/configuration";
import { AuthModule } from "./auth/AuthModule";
import { Public } from "./auth/authDecorators";
import { DIONYSUS_MODULES, DionysusModule } from "./dionysus/DionysusModule";
import { GraphQLClientModule } from "./infra/GraphQLClientModule";
import { RabbitModule } from "./infra/RabbitModule";
import { MINERVA_MODULES, MinervaModule } from "./minerva/MinervaModule";
import { OLYMPUS_MODULES, OlympusModule } from "./olympus/OlympusModule";
import { NotificationsGatewayModule } from "./olympus/notifications/gateway/NotificationsGatewayModule";
import { Routes } from "./utils/routes";

// Prometheus scrapes /metrics and Docker checks /health without
// credentials (ADR 0018, 0019).
Public()(MetricsController);
Public()(HealthController);

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `${process.env.NODE_ENV}.env`,
      isGlobal: true,
      // Typed namespaces (config/configuration.ts); each validates the
      // environment when first injected. main.ts validates it up front.
      load: ALL_CONFIG,
    }),
    // /metrics; request metrics are recorded by configureApp.
    MetricsModule.forRootAsync({
      inject: [serverConfig.KEY],
      useFactory: (server: ServerConfigType) => ({
        app: server.appName,
        environment: server.nodeEnv,
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
    AuthModule,
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
