import { isIP } from "node:net";
import { ConfigType, registerAs } from "@nestjs/config";
import {
  AmqpConfig,
  ConfigValidationError,
  EnvReader,
  LoggingConfig,
  readAmqpConfig,
  readLoggingConfig,
  readRuntimeConfig,
  RuntimeConfig,
} from "@ncfritz/olympus-nest";
import { parseProviders, type ProviderConfig } from "../auth/clients/providers";

export { ConfigValidationError };
export type { AmqpConfig, LoggingConfig };

export type ServerConfig = RuntimeConfig & {
  /** Serve the OpenAPI explorer (always outside production). */
  apiExplorer: boolean;
  corsOrigins: string[];
  /**
   * Proxies whose `X-Forwarded-For` may be believed, as express's
   * `trust proxy` takes them: addresses or CIDR ranges, or `loopback`,
   * `linklocal`, `uniquelocal`. Empty means trust nothing, and then
   * `request.ip` is the proxy's own address — correct, but it tells no two
   * callers apart, which is why the rate limiter has a global ceiling.
   */
  trustedProxies: string[];
};

export type HasuraConfig = {
  host: string;
  /** GraphQL endpoint, e.g. http://localhost:8080/v1/graphql */
  endpoint: string;
  adminSecret: string;
};

export type DionysusConfig = {
  /** Where uploaded content assets are written. */
  uploadPath: string;
  /** The same directory as the ingest agents see it. */
  publishPath: string;
};

/** How a listener treats a request it cannot authenticate (ADR 0018). */
export type AuthMode = "report" | "enforce";

export type AuthConfig = {
  /** Per listener: `report` logs and counts what it would reject. */
  modes: { users: AuthMode; services: AuthMode };
  /**
   * Whether the auth endpoints' rate limits apply.
   *
   * On by default, and there is an off switch because this is a mechanism
   * whose own failure mode is refusing legitimate people: a limit that turns
   * out to be too low, or a per-caller key that stops telling callers apart,
   * locks users out, and the fix should not have to be a deploy.
   */
  rateLimits: "on" | "off";
  /** Certificate common name -> the roles that service has. */
  serviceRoles: Record<string, string[]>;
  /**
   * The common name of the CA that must have signed a client certificate.
   * The issuing CAs for services and for devices are siblings, so the
   * chain alone does not tell them apart (ADR 0023). Unset: not checked.
   */
  servicesIssuer?: string;
  /** Signing in: unset until the token service is configured. */
  users: {
    /** A directory of ES256 PEMs; the last filename signs, all verify. */
    signingKeys?: string;
    /** Where the site is served, for exact redirect-URI matching. */
    clientOrigins: string[];
    /**
     * Where a browser reaches the API, for the redirect URI the providers
     * are registered with — one canonical origin, not whichever the person
     * arrived on. e.g. https://olympus.ncfritz.net/api
     */
    publicBaseUrl?: string;
    providers: ProviderConfig[];
  };
  services: {
    /** Off until the certificates are configured. */
    enabled: boolean;
    port: number;
    certificate: string;
    key: string;
    /** The Olympus Services chain the listener trusts. */
    ca: string;
    /** One file per signing authority in the chain (ADR 0023). */
    revocationLists: string[];
  };
};

/** Weather: forecasts, map tiles and the house's stations (ADR 0024). */
export type WeatherConfig = {
  /** Unset: forecasts and map layers answer 503 (the boot log says so). */
  openWeatherApiKey?: string;
  /** Backfill from ambientweather.net; off unless both are set. */
  ambient?: { applicationKey: string; apiKey: string };
  /** Per provider call. */
  providerTimeoutMs: number;
  forecast: {
    /** How long a fetched forecast is served before it is refetched. */
    ttlSeconds: number;
    /** How long the last good one is served, marked stale, on failure. */
    maxStaleSeconds: number;
  };
  tiles: {
    /** The tile cache's bound; least recently used tiles go first. */
    cacheMb: number;
    /** OpenWeather layer tiles; radar tiles live as long as their frame. */
    ttlSeconds: number;
  };
  stations: {
    /** Parsed pushes are deleted after this; the tiers keep their own. */
    sampleRetentionHours: number;
    /** A station with no sample for this long is not reporting. */
    staleSeconds: number;
    /**
     * Where a push may come from (by the forwarded address). Empty: the
     * push route accepts nothing, which is the safe way to be unconfigured.
     */
    allowedCidrs: string[];
    /** Where the raw archive is written: one JSONL file per station-day. */
    archiveDir: string;
  };
};

export type AppConfig = {
  server: ServerConfig;
  auth: AuthConfig;
  hasura: HasuraConfig;
  amqp: AmqpConfig;
  logging: LoggingConfig;
  dionysus: DionysusConfig;
  weather: WeatherConfig;
};

/**
 * The API configuration from environment variables (see dev.env.example).
 * @throws ConfigValidationError listing every invalid or missing variable
 */
export const readConfig = (
  env: Record<string, string | undefined>,
): AppConfig => {
  const read = new EnvReader(env);

  const runtime = readRuntimeConfig(read, "olympus-api", 3100);
  const server: ServerConfig = {
    ...runtime,
    apiExplorer:
      read.boolean("ENABLE_API_EXPLORER", false) || !runtime.isProduction,
    corsOrigins: read.list("CORS_ORIGINS", ["http://localhost:3000"]),
    trustedProxies: read.list("TRUSTED_PROXIES", []),
  };

  const hasuraProtocol = read.oneOf(
    "HASURA_PROTOCOL",
    ["http", "https"],
    "http",
  );
  const hasuraHost = read.string("HASURA_HOST", "localhost");
  const hasuraPort = read.port("HASURA_PORT", 8080);
  const hasura: HasuraConfig = {
    host: hasuraHost,
    endpoint: `${hasuraProtocol}://${hasuraHost}:${hasuraPort}/v1/graphql`,
    adminSecret: read.string("HASURA_PASSWORD", ""),
  };

  const amqp = readAmqpConfig(read, "/dionysus");
  const logging = readLoggingConfig(read, runtime.isProduction);

  const auth = readAuthConfig(read);

  const dionysus: DionysusConfig = {
    uploadPath: read.string("DIONYSUS_UPLOAD_PATH"),
    publishPath: read.string("DIONYSUS_PUBLISH_PATH"),
  };

  const weather = readWeatherConfig(read);

  if (read.problems.length) throw new ConfigValidationError(read.problems);
  return { server, auth, hasura, amqp, logging, dionysus, weather };
};

/**
 * AUTH_SERVICE_ROLES lists what each service certificate may do:
 * `dionysus-asset-agent:agent|content,dionysus-search-agent:agent`.
 */
const readServiceRoles = (read: EnvReader): Record<string, string[]> => {
  const roles: Record<string, string[]> = {};
  for (const entry of read.list("AUTH_SERVICE_ROLES", [])) {
    const [name, granted] = entry.split(":");
    if (!name || !granted) {
      read.problems.push(
        `AUTH_SERVICE_ROLES entries are "<service>:<role>|<role>", got "${entry}"`,
      );
      continue;
    }
    roles[name.trim()] = granted
      .split("|")
      .map((role) => role.trim())
      .filter(Boolean);
  }
  return roles;
};

const readAuthConfig = (read: EnvReader): AuthConfig => {
  const modes = {
    users: read.oneOf<AuthMode>(
      "AUTH_MODE_USERS",
      ["report", "enforce"],
      "report",
    ),
    services: read.oneOf<AuthMode>(
      "AUTH_MODE_SERVICES",
      ["report", "enforce"],
      "report",
    ),
  };
  const certificate = read.optional("TLS_CERT");
  const key = read.optional("TLS_KEY");
  const ca = read.optional("TLS_CA_SERVICES");
  const revocationLists = read.list("TLS_CRL_SERVICES", []);
  const enabled = Boolean(certificate && key && ca);
  if (!enabled && (certificate || key || ca)) {
    read.problems.push(
      "TLS_CERT, TLS_KEY and TLS_CA_SERVICES are set together or not at all",
    );
  }
  const providersRaw = read.optional("AUTH_OIDC_PROVIDERS");
  return {
    modes,
    rateLimits: read.oneOf<"on" | "off">(
      "AUTH_RATE_LIMITS",
      ["on", "off"],
      "on",
    ),
    serviceRoles: readServiceRoles(read),
    servicesIssuer: read.optional("AUTH_SERVICES_ISSUER"),
    users: {
      signingKeys: read.optional("AUTH_SIGNING_KEYS"),
      clientOrigins: read.list("AUTH_CLIENT_ORIGINS", []),
      publicBaseUrl: read.optional("AUTH_PUBLIC_BASE_URL"),
      providers:
        providersRaw === undefined
          ? []
          : parseProviders(providersRaw, read.problems),
    },
    services: {
      enabled,
      port: read.port("SERVICES_LISTEN_PORT", 3443),
      certificate: certificate ?? "",
      key: key ?? "",
      ca: ca ?? "",
      revocationLists,
    },
  };
};

/** A whole number of at least `min`, or the fallback when unset. */
const readInteger = (
  read: EnvReader,
  name: string,
  fallback: number,
  min = 1,
): number => {
  const raw = read.optional(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    read.problems.push(`${name} must be a whole number of at least ${min}`);
    return fallback;
  }
  return value;
};

/** `192.168.1.0/24`, `fd00::/8`, or a bare address (one host). */
export const isCidr = (value: string): boolean => {
  const [address, prefix, ...rest] = value.split("/");
  const family = isIP(address ?? "");
  if (family === 0 || rest.length > 0) return false;
  if (prefix === undefined) return true;
  const bits = Number(prefix);
  return /^\d+$/.test(prefix) && bits >= 0 && bits <= (family === 4 ? 32 : 128);
};

const readWeatherConfig = (read: EnvReader): WeatherConfig => {
  const applicationKey = read.optional("AMBIENT_APPLICATION_KEY");
  const apiKey = read.optional("AMBIENT_API_KEY");
  if (Boolean(applicationKey) !== Boolean(apiKey)) {
    read.problems.push(
      "AMBIENT_APPLICATION_KEY and AMBIENT_API_KEY are set together or not at all",
    );
  }
  const allowedCidrs = read.list("WEATHER_STATION_ALLOWED_CIDRS", []);
  for (const cidr of allowedCidrs) {
    if (!isCidr(cidr)) {
      read.problems.push(
        `WEATHER_STATION_ALLOWED_CIDRS entries are addresses or CIDR ranges, got "${cidr}"`,
      );
    }
  }
  return {
    openWeatherApiKey: read.optional("OPENWEATHER_API_KEY"),
    ambient: applicationKey && apiKey ? { applicationKey, apiKey } : undefined,
    providerTimeoutMs: readInteger(read, "WEATHER_PROVIDER_TIMEOUT_MS", 5000),
    forecast: {
      ttlSeconds: readInteger(read, "WEATHER_FORECAST_TTL_SECONDS", 900),
      maxStaleSeconds: readInteger(
        read,
        "WEATHER_FORECAST_MAX_STALE_SECONDS",
        21600,
      ),
    },
    tiles: {
      cacheMb: readInteger(read, "WEATHER_TILE_CACHE_MB", 128),
      ttlSeconds: readInteger(read, "WEATHER_TILE_TTL_SECONDS", 1800),
    },
    stations: {
      sampleRetentionHours: readInteger(
        read,
        "WEATHER_SAMPLE_RETENTION_HOURS",
        48,
      ),
      staleSeconds: readInteger(read, "WEATHER_STATION_STALE_SECONDS", 600),
      allowedCidrs,
      archiveDir: read.string(
        "WEATHER_ARCHIVE_DIR",
        "/olympus/weather/archive",
      ),
    },
  };
};

/*
 * Typed configuration namespaces. Inject one with
 * `@Inject(hasuraConfig.KEY) hasura: ConfigType<typeof hasuraConfig>`, or
 * list `hasuraConfig.KEY` in a factory provider's `inject`.
 */
export const serverConfig = registerAs(
  "server",
  () => readConfig(process.env).server,
);
export const authConfig = registerAs(
  "auth",
  () => readConfig(process.env).auth,
);
export const hasuraConfig = registerAs(
  "hasura",
  () => readConfig(process.env).hasura,
);
export const amqpConfig = registerAs(
  "amqp",
  () => readConfig(process.env).amqp,
);
export const loggingConfig = registerAs(
  "logging",
  () => readConfig(process.env).logging,
);
export const dionysusConfig = registerAs(
  "dionysus",
  () => readConfig(process.env).dionysus,
);

export const weatherConfig = registerAs(
  "weather",
  () => readConfig(process.env).weather,
);

export type ServerConfigType = ConfigType<typeof serverConfig>;
export type AuthConfigType = ConfigType<typeof authConfig>;
export type HasuraConfigType = ConfigType<typeof hasuraConfig>;
export type AmqpConfigType = ConfigType<typeof amqpConfig>;
export type DionysusConfigType = ConfigType<typeof dionysusConfig>;
export type WeatherConfigType = ConfigType<typeof weatherConfig>;

export const ALL_CONFIG = [
  serverConfig,
  authConfig,
  hasuraConfig,
  amqpConfig,
  loggingConfig,
  dionysusConfig,
  weatherConfig,
];
