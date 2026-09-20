import {
  MetricsController,
  MetricsModule as SharedMetricsModule,
} from "@ncfritz/olympus-nest";
import { Module } from "@nestjs/common";
import { Public } from "../auth/public";
import { serverConfig, type ServerConfigType } from "../config/configuration";

// /metrics is for Prometheus: no access token, like the provider callbacks.
Public()(MetricsController);

/**
 * Prometheus metrics at /metrics (ADR 0017): Node's defaults, the
 * management API's requests (configureApp) and the agent's own
 * (agentMetrics).
 */
@Module({
  imports: [
    SharedMetricsModule.forRootAsync({
      inject: [serverConfig.KEY],
      useFactory: (server: ServerConfigType) => ({
        app: server.appName,
        environment: server.nodeEnv,
      }),
    }),
  ],
})
export class MetricsModule {}
