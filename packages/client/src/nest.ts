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
import { CertificateRenewer } from "./renewal";
import { type ClientTlsOptions, tlsAxiosOptions } from "./tls";

/** The OlympusClients, for SDK calls the wrappers don't cover. */
export const OLYMPUS_CLIENTS = Symbol("OLYMPUS_CLIENTS");

/** The service's CertificateRenewer, or null when it does not renew itself. */
export const CERTIFICATE_RENEWER = Symbol("CERTIFICATE_RENEWER");

const OPTIONS = Symbol("OLYMPUS_CLIENT_MODULE_OPTIONS");

/** createOlympusClients' options; metrics are always recorded (prom-client). */
export type OlympusClientModuleOptions = Omit<
  OlympusClientOptions,
  "metrics"
> & {
  /**
   * The certificate to present to the API's mTLS listener (ADR 0018).
   * Without it the clients are plain HTTP, as they were before.
   */
  tls?: ClientTlsOptions;
};

/**
 * The Olympus API for a Nest service (ADR 0017): creates the clients once
 * and provides every wrapper (NotificationApi, MetadataApi, ...) for
 * injection by class.
 *
 *   OlympusClientModule.forRootAsync({
 *     inject: [olympusConfig.KEY, runtimeConfig.KEY],
 *     useFactory: (olympus, runtime) => ({
 *       baseUrl: olympus.apiBaseUrl,
 *       clientName: runtime.serviceName, // the certificate's name
 *       tls: olympus.tls,
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
    const resolvedOptions: Provider = {
      provide: OPTIONS,
      inject: (options.inject ?? []) as never[],
      useFactory: options.useFactory,
    };
    // The certificate renews itself when its options say where (ADR 0020):
    // the agent below picks the renewal up from the files.
    const renewer: Provider = {
      provide: CERTIFICATE_RENEWER,
      inject: [OPTIONS],
      useFactory: (resolved: OlympusClientModuleOptions) => {
        const tls = resolved.tls;
        if (!tls?.renewal) return null;
        const renewer = new CertificateRenewer(
          { ...tls, renewal: tls.renewal },
          new Logger(CertificateRenewer.name),
        );
        renewer.start();
        return renewer;
      },
    };
    const clients: Provider = {
      provide: OLYMPUS_CLIENTS,
      inject: [OPTIONS],
      useFactory: (resolved: OlympusClientModuleOptions) => {
        new Logger(OlympusClientModule.name).log(
          `Using the Olympus API at ${resolved.baseUrl} as ${resolved.clientName}` +
            (resolved.tls ? ` with ${resolved.tls.certificate}` : ""),
        );
        return createOlympusClients({
          ...resolved,
          axios: { ...resolved.axios, ...tlsAxiosOptions(resolved.tls) },
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
      providers: [resolvedOptions, renewer, clients, ...apis],
      exports: [OLYMPUS_CLIENTS, CERTIFICATE_RENEWER, ...OLYMPUS_APIS],
    };
  }
}
