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

export { ConfigValidationError };
export type { AmqpConfig, LoggingConfig };

export type ServerConfig = RuntimeConfig & {
  /** Serve the OpenAPI explorer (always outside production). */
  apiExplorer: boolean;
  corsOrigins: string[];
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
  /** Certificate common name -> the roles that service has. */
  serviceRoles: Record<string, string[]>;
  /**
   * The common name of the CA that must have signed a client certificate.
   * The issuing CAs for services and for devices are siblings, so the
   * chain alone does not tell them apart (ADR 0023). Unset: not checked.
   */
  servicesIssuer?: string;
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

export type AppConfig = {
  server: ServerConfig;
  auth: AuthConfig;
  hasura: HasuraConfig;
  amqp: AmqpConfig;
  logging: LoggingConfig;
  dionysus: DionysusConfig;
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

  if (read.problems.length) throw new ConfigValidationError(read.problems);
  return { server, auth, hasura, amqp, logging, dionysus };
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
  return {
    modes,
    serviceRoles: readServiceRoles(read),
    servicesIssuer: read.optional("AUTH_SERVICES_ISSUER"),
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

export type ServerConfigType = ConfigType<typeof serverConfig>;
export type AuthConfigType = ConfigType<typeof authConfig>;
export type HasuraConfigType = ConfigType<typeof hasuraConfig>;
export type AmqpConfigType = ConfigType<typeof amqpConfig>;
export type DionysusConfigType = ConfigType<typeof dionysusConfig>;

export const ALL_CONFIG = [
  serverConfig,
  authConfig,
  hasuraConfig,
  amqpConfig,
  loggingConfig,
  dionysusConfig,
];
