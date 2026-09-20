import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ApiExcludeController } from "@nestjs/swagger";
import { MetricsController, ReporterModule } from "nestjs-metrics-reporter";
import { Public } from "../auth/public";
import { serverConfig, type ServerConfigType } from "../config/configuration";
import { OperationMetricsInterceptor } from "./OperationMetricsInterceptor";

// The library's /metrics route is for Prometheus: outside the management
// API document and its access token, like the provider callbacks.
ApiExcludeController()(MetricsController);
Public()(MetricsController);

/** Prometheus metrics at /metrics: Node's defaults, the operations and agentMetrics. */
@Module({
  imports: [
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
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: OperationMetricsInterceptor },
  ],
})
export class MetricsModule {}
