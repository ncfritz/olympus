import {
  HealthController,
  MetricsController,
  MetricsModule as SharedMetricsModule,
} from "@ncfritz/olympus-nest";
import { Module } from "@nestjs/common";
import { Public } from "../auth/public";
import { serverConfig, type ServerConfigType } from "../config/configuration";
import { PkiGaugeService } from "./services/PkiGaugeService";

// /metrics is for Prometheus and /health for Docker: no access token.
Public()(MetricsController);
Public()(HealthController);

/**
 * Prometheus metrics at /metrics (ADR 0017) and /health for Docker: Node's
 * defaults, the management API's requests (configureApp), and the CA's own
 * (pkiMetrics, PkiGaugeService; ADR 0020, Monitoring).
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
  providers: [PkiGaugeService],
})
export class MetricsModule {}
