import { UNKNOWN } from "@ncfritz/olympus-metrics";
import {
  Controller,
  type DynamicModule,
  Get,
  Global,
  HttpStatus,
  Inject,
  Module,
  type ModuleMetadata,
  type OnModuleInit,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { collectDefaultMetrics, register } from "prom-client";

export interface MetricsOptions {
  /** The service's name: the `app` label on every metric, and the `client` of its outbound requests. */
  app: string;
  /** The `environment` label on every metric. */
  environment: string;
}

export const METRICS_OPTIONS = Symbol("METRICS_OPTIONS");

let defaultMetricsCollected = false;
let clientName = UNKNOWN;

/** The running service's name (MetricsModule's `app`), or `unknown` before it starts. */
export const metricsClientName = (): string => clientName;

/** What `response` needs to be for MetricsController (Express's Response). */
interface PlainResponse {
  status(code: number): PlainResponse;
  setHeader(name: string, value: string): unknown;
  send(body: string): unknown;
}

/** Serves prom-client's default registry for Prometheus. */
@ApiExcludeController()
@Controller({ path: "metrics", version: VERSION_NEUTRAL })
export class MetricsController {
  @Get()
  async handle(@Res() response: PlainResponse): Promise<void> {
    const body = await register.metrics();
    response.setHeader("Content-Type", register.contentType);
    response.status(HttpStatus.OK).send(body);
  }
}

/**
 * Prometheus metrics at /metrics (ADR 0017): Node's defaults and whatever
 * the service records on prom-client's default registry, labelled with
 * `app` and `environment`. The request histograms come from
 * useHttpServerMetrics (inbound) and the Olympus client or
 * ExecuteWithMetrics (outbound).
 */
@Global()
@Module({})
export class MetricsModule implements OnModuleInit {
  constructor(
    @Inject(METRICS_OPTIONS) private readonly options: MetricsOptions,
  ) {}

  static forRootAsync(options: {
    imports?: ModuleMetadata["imports"];
    inject?: unknown[];
    useFactory: (...args: never[]) => MetricsOptions | Promise<MetricsOptions>;
  }): DynamicModule {
    return {
      module: MetricsModule,
      imports: options.imports ?? [],
      controllers: [MetricsController],
      providers: [
        {
          provide: METRICS_OPTIONS,
          inject: (options.inject ?? []) as never[],
          useFactory: options.useFactory,
        },
      ],
      exports: [METRICS_OPTIONS],
    };
  }

  onModuleInit(): void {
    register.setDefaultLabels({
      app: this.options.app,
      environment: this.options.environment,
    });
    // Once per process: tests create many applications.
    if (!defaultMetricsCollected) {
      collectDefaultMetrics();
      defaultMetricsCollected = true;
    }
    clientName = this.options.app;
  }
}
