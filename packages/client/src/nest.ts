import { createPrometheusRequestMetrics } from "@ncfritz/olympus-metrics/prometheus";
import {
  type DynamicModule,
  Global,
  Logger,
  Module,
  type ModuleMetadata,
  type Provider,
} from "@nestjs/common";
import {
  createOlympusClients,
  type OlympusClientOptions,
  type OlympusClients,
} from "./clients";
import { OLYMPUS_APIS } from "./index";

/** The OlympusClients, for SDK calls the wrappers don't cover. */
export const OLYMPUS_CLIENTS = Symbol("OLYMPUS_CLIENTS");

/** createOlympusClients' options; metrics are always recorded (prom-client). */
export type OlympusClientModuleOptions = Omit<OlympusClientOptions, "metrics">;

/**
 * The Olympus API for a Nest service (ADR 0017): creates the clients once
 * and provides every wrapper (NotificationApi, MetadataApi, ...) for
 * injection by class.
 *
 *   OlympusClientModule.forRootAsync({
 *     inject: [olympusConfig.KEY, runtimeConfig.KEY],
 *     useFactory: (olympus, runtime) => ({
 *       baseUrl: olympus.apiBaseUrl,
 *       clientName: runtime.appName,
 *     }),
 *   })
 */
@Global()
@Module({})
export class OlympusClientModule {
  static forRootAsync(options: {
    imports?: ModuleMetadata["imports"];
    inject?: unknown[];
    useFactory: (
      ...args: never[]
    ) => OlympusClientModuleOptions | Promise<OlympusClientModuleOptions>;
  }): DynamicModule {
    const clients: Provider = {
      provide: OLYMPUS_CLIENTS,
      inject: (options.inject ?? []) as never[],
      useFactory: async (...args: never[]) => {
        const resolved = await options.useFactory(...args);
        new Logger(OlympusClientModule.name).log(
          `Using the Olympus API at ${resolved.baseUrl} as ${resolved.clientName}`,
        );
        return createOlympusClients({
          ...resolved,
          metrics: createPrometheusRequestMetrics(),
        });
      },
    };
    const apis: Provider[] = OLYMPUS_APIS.map((api) => ({
      provide: api,
      inject: [OLYMPUS_CLIENTS],
      useFactory: (c: OlympusClients) => new api(c),
    }));
    return {
      module: OlympusClientModule,
      imports: options.imports ?? [],
      providers: [clients, ...apis],
      exports: [OLYMPUS_CLIENTS, ...OLYMPUS_APIS],
    };
  }
}
