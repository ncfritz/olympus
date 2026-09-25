import { MetricsModule as SharedMetricsModule } from "@ncfritz/olympus-nest";
import { Module } from "@nestjs/common";
import { serverConfig, type ServerConfigType } from "../config/configuration";

/**
 * Prometheus metrics at /metrics (ADR 0017) and /health for Docker: Node's
 * defaults and the management API's requests (configureApp). The CA's own
 * metrics (ADR 0020) join them with the features that record them.
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
