import {
  CLIENT_HEADER,
  createOperationLookup,
  isClientName,
  type OperationEntry,
  type RequestMetrics,
  UNKNOWN,
} from "@ncfritz/olympus-metrics";
import * as dionysus from "@ncfritz/olympus-sdk/dionysus";
import * as minerva from "@ncfritz/olympus-sdk/minerva";
import * as olympus from "@ncfritz/olympus-sdk/olympus";

/** One SDK client per API document, all with the same base URL and caller. */
export interface OlympusClients {
  olympus: olympus.Client;
  dionysus: dionysus.Client;
  minerva: minerva.Client;
}

export interface OlympusClientOptions {
  /** The API's base URL, including the version: http://olympus-api:3100/v1 */
  baseUrl: string;
  /**
   * The caller's name (lower case, e.g. dionysus-metadata-agent): sent as
   * X-Olympus-Client and the `client` label of its request metrics.
   */
  clientName: string;
  /** The API's service name, the `server` label (default olympus-api). */
  serverName?: string;
  /** Where to record request metrics; nothing is recorded without it (browsers). */
  metrics?: RequestMetrics;
  /** More axios configuration for every client: headers, timeout, withCredentials, adapter. */
  axios?: Record<string, unknown>;
}

export const OLYMPUS_API_SERVER = "olympus-api";

/** Axios config fields the interceptors read and write. */
type TimedConfig = {
  url?: string;
  method?: string;
  headers?: { set?: (name: string, value: string) => unknown };
  olympusStartedAt?: number;
};
type Answer = { status?: number; config?: TimedConfig };

/**
 * Creates the SDK clients for the Olympus APIs. Every request carries the
 * caller's name, and with `metrics` is recorded as
 * http_client_request_duration_seconds with its API, tag and operation
 * (ADR 0017). Pass a client to an SDK call, or use the wrappers
 * (NotificationApi, MetadataApi, ...).
 */
export const createOlympusClients = (
  options: OlympusClientOptions,
): OlympusClients => {
  if (!isClientName(options.clientName)) {
    throw new Error(
      `Invalid client name "${options.clientName}": use lower case letters, digits and dashes`,
    );
  }
  const basePath = new URL(options.baseUrl, "http://base").pathname.replace(
    /\/+$/,
    "",
  );
  const create = <C extends olympus.Client>(sdk: {
    createClient: (config: never) => C;
    createConfig: (config: never) => unknown;
    operations: readonly OperationEntry[];
  }): C => {
    const client = sdk.createClient(
      sdk.createConfig({
        ...options.axios,
        baseURL: options.baseUrl,
        throwOnError: true,
      } as never) as never,
    );
    instrument(
      client,
      createOperationLookup(sdk.operations),
      basePath,
      options,
    );
    return client;
  };

  return {
    olympus: create(olympus),
    dionysus: create(dionysus),
    minerva: create(minerva),
  };
};

const instrument = (
  client: olympus.Client,
  lookup: ReturnType<typeof createOperationLookup>,
  basePath: string,
  options: OlympusClientOptions,
) => {
  const interceptors = client.instance.interceptors;
  interceptors.request.use((config) => {
    const timed = config as unknown as TimedConfig;
    timed.headers?.set?.(CLIENT_HEADER, options.clientName);
    timed.olympusStartedAt = performance.now();
    return config;
  });

  if (!options.metrics) return;
  const metrics = options.metrics;
  const record = (
    answer: Answer | undefined,
    config: TimedConfig | undefined,
  ) => {
    if (!config?.url || config.olympusStartedAt === undefined) return;
    let path = new URL(config.url, "http://base").pathname;
    if (basePath && path.startsWith(`${basePath}/`)) {
      path = path.slice(basePath.length);
    }
    const method = (config.method ?? UNKNOWN).toUpperCase();
    const operation = lookup(method, path);
    metrics.observeClientRequest({
      client: options.clientName,
      server: options.serverName ?? OLYMPUS_API_SERVER,
      api: operation?.api ?? UNKNOWN,
      tag: operation?.tag ?? UNKNOWN,
      operation: operation?.operationId ?? UNKNOWN,
      method,
      statusCode: answer?.status,
      durationSeconds: (performance.now() - config.olympusStartedAt) / 1000,
    });
  };

  interceptors.response.use(
    (response) => {
      record(response as Answer, response.config as unknown as TimedConfig);
      return response;
    },
    (error: { response?: Answer; config?: TimedConfig }) => {
      record(error.response, error.config ?? error.response?.config);
      return Promise.reject(error);
    },
  );
};
