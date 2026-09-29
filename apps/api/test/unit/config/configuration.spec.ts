import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  isCidr,
  readConfig,
} from "../../../src/config/configuration";

const REQUIRED = {
  DIONYSUS_UPLOAD_PATH: "/upload",
  DIONYSUS_PUBLISH_PATH: "/publish",
};

describe("readConfig", () => {
  it("applies the defaults", () => {
    const config = readConfig(REQUIRED);
    expect(config.server).toEqual({
      nodeEnv: "development",
      isProduction: false,
      appName: "olympus-api-development",
      port: 3100,
      apiExplorer: true,
      corsOrigins: ["http://localhost:3000"],
      // Nothing is trusted unless a deployment says so, so request.ip is the
      // immediate peer and the auth rate limits count it as one caller.
      trustedProxies: [],
    });
    expect(config.hasura.endpoint).toBe("http://localhost:8080/v1/graphql");
    expect(config.amqp.uri).toBe(
      "amqp://admin:admin@localhost:5672/%2Fdionysus",
    );
    expect(config.logging.console.enabled).toBe(true);
    expect(config.logging.file.enabled).toBe(false);
    expect(config.dionysus).toEqual({
      uploadPath: "/upload",
      publishPath: "/publish",
    });
  });

  it("switches production defaults", () => {
    const config = readConfig({ ...REQUIRED, NODE_ENV: "production" });
    expect(config.server.appName).toBe("olympus-api");
    expect(config.server.apiExplorer).toBe(false);
    expect(config.logging.console.enabled).toBe(false);
    expect(config.logging.file.enabled).toBe(true);
  });

  it("reads explicit values", () => {
    const config = readConfig({
      ...REQUIRED,
      LISTEN_PORT: "3001",
      CORS_ORIGINS: "https://a.example, https://b.example",
      HASURA_PROTOCOL: "https",
      HASURA_HOST: "hasura",
      HASURA_PORT: "443",
      HASURA_PASSWORD: "secret",
      AMQP_PROTOCOL: "amqps",
      AMQP_USER: "olympus",
      AMQP_PASSWORD: "p@ss",
      AMQP_VHOST: "/",
    });
    expect(config.server.port).toBe(3001);
    expect(config.server.corsOrigins).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
    expect(config.hasura).toEqual({
      host: "hasura",
      endpoint: "https://hasura:443/v1/graphql",
      adminSecret: "secret",
    });
    expect(config.amqp.uri).toBe("amqps://olympus:p@ss@localhost:5672/%2F");
  });

  it("never exposes the AMQP password in the redacted URI", () => {
    const { amqp } = readConfig({ ...REQUIRED, AMQP_PASSWORD: "s3cret" });
    expect(amqp.uri).toContain("s3cret");
    expect(amqp.redactedUri).not.toContain("s3cret");
    expect(amqp.redactedUri).toBe(
      "amqp://admin:***@localhost:5672/%2Fdionysus",
    );
  });

  it("reports every problem at once", () => {
    let error: unknown;
    try {
      readConfig({
        LISTEN_PORT: "http",
        HASURA_PROTOCOL: "ftp",
        ENABLE_API_EXPLORER: "yes",
        CONSOLE_LOGGING_LEVEL: "loud",
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigValidationError);
    expect((error as ConfigValidationError).problems).toEqual([
      'LISTEN_PORT must be a port number, got "http"',
      'ENABLE_API_EXPLORER must be "true" or "false", got "yes"',
      'HASURA_PROTOCOL must be one of http, https, got "ftp"',
      'CONSOLE_LOGGING_LEVEL must be one of error, warn, info, http, verbose, debug, silly, got "loud"',
      "DIONYSUS_UPLOAD_PATH is required",
      "DIONYSUS_PUBLISH_PATH is required",
    ]);
  });
});

describe("readConfig: authentication", () => {
  it("reports on both listeners until it is told to enforce", () => {
    const { auth } = readConfig(REQUIRED);
    expect(auth.modes).toEqual({ users: "report", services: "report" });
    expect(auth.serviceRoles).toEqual({});
    expect(auth.services.enabled).toBe(false);
    expect(auth.services.port).toBe(3443);
  });

  it("enables the services listener once it has certificates", () => {
    const { auth } = readConfig({
      ...REQUIRED,
      AUTH_MODE_SERVICES: "enforce",
      SERVICES_LISTEN_PORT: "4443",
      TLS_CERT: "/certs/api.crt",
      TLS_KEY: "/certs/api.key",
      TLS_CA_SERVICES: "/certs/services-ca.crt",
      TLS_CRL_SERVICES: "/certs/services.crl, /certs/root.crl",
    });
    expect(auth.modes.services).toBe("enforce");
    expect(auth.services).toEqual({
      enabled: true,
      port: 4443,
      certificate: "/certs/api.crt",
      key: "/certs/api.key",
      ca: "/certs/services-ca.crt",
      revocationLists: ["/certs/services.crl", "/certs/root.crl"],
    });
  });

  it("reads the roles each service certificate is granted", () => {
    const { auth } = readConfig({
      ...REQUIRED,
      AUTH_SERVICE_ROLES:
        "dionysus-asset-agent:agent|content, dionysus-search-agent:agent",
    });
    expect(auth.serviceRoles).toEqual({
      "dionysus-asset-agent": ["agent", "content"],
      "dionysus-search-agent": ["agent"],
    });
  });

  it("refuses half a TLS configuration and a malformed role", () => {
    let error: unknown;
    try {
      readConfig({
        ...REQUIRED,
        TLS_CERT: "/certs/api.crt",
        AUTH_MODE_USERS: "loud",
        AUTH_SERVICE_ROLES: "dionysus-asset-agent",
      });
    } catch (e) {
      error = e;
    }
    expect((error as ConfigValidationError).problems).toEqual([
      'AUTH_MODE_USERS must be one of report, enforce, got "loud"',
      "TLS_CERT, TLS_KEY and TLS_CA_SERVICES are set together or not at all",
      'AUTH_SERVICE_ROLES entries are "<service>:<role>|<role>", got "dionysus-asset-agent"',
    ]);
  });

  it("defaults the weather settings to a safe, unconfigured state", () => {
    const { weather } = readConfig(REQUIRED);
    expect(weather).toEqual({
      openWeatherApiKey: undefined,
      ambient: undefined,
      providerTimeoutMs: 5000,
      forecast: { ttlSeconds: 900, maxStaleSeconds: 21600 },
      tiles: { cacheMb: 128, ttlSeconds: 1800 },
      stations: {
        sampleRetentionHours: 48,
        staleSeconds: 600,
        // Nothing is accepted from anywhere until a deployment says where.
        allowedCidrs: [],
        archiveDir: "/olympus/weather/archive",
      },
    });
  });

  it("reads the weather settings", () => {
    const { weather } = readConfig({
      ...REQUIRED,
      OPENWEATHER_API_KEY: "ow-key",
      AMBIENT_APPLICATION_KEY: "app-key",
      AMBIENT_API_KEY: "api-key",
      WEATHER_FORECAST_TTL_SECONDS: "600",
      WEATHER_TILE_CACHE_MB: "64",
      WEATHER_STATION_ALLOWED_CIDRS: "192.168.1.0/24, 10.0.0.5, fd00::/8",
      WEATHER_ARCHIVE_DIR: "/archive",
    });
    expect(weather.openWeatherApiKey).toBe("ow-key");
    expect(weather.ambient).toEqual({
      applicationKey: "app-key",
      apiKey: "api-key",
    });
    expect(weather.forecast.ttlSeconds).toBe(600);
    expect(weather.tiles.cacheMb).toBe(64);
    expect(weather.stations.allowedCidrs).toEqual([
      "192.168.1.0/24",
      "10.0.0.5",
      "fd00::/8",
    ]);
    expect(weather.stations.archiveDir).toBe("/archive");
  });

  it("refuses half the Ambient keys, bad numbers and bad ranges", () => {
    let error: unknown;
    try {
      readConfig({
        ...REQUIRED,
        AMBIENT_API_KEY: "api-key",
        WEATHER_TILE_CACHE_MB: "lots",
        WEATHER_FORECAST_TTL_SECONDS: "0",
        WEATHER_STATION_ALLOWED_CIDRS: "192.168.1.0/33,lan",
      });
    } catch (e) {
      error = e;
    }
    expect((error as ConfigValidationError).problems).toEqual([
      "AMBIENT_APPLICATION_KEY and AMBIENT_API_KEY are set together or not at all",
      'WEATHER_STATION_ALLOWED_CIDRS entries are addresses or CIDR ranges, got "192.168.1.0/33"',
      'WEATHER_STATION_ALLOWED_CIDRS entries are addresses or CIDR ranges, got "lan"',
      "WEATHER_FORECAST_TTL_SECONDS must be a whole number of at least 1",
      "WEATHER_TILE_CACHE_MB must be a whole number of at least 1",
    ]);
  });
});

describe("isCidr", () => {
  it.each(["10.0.0.0/8", "192.168.1.7", "::1", "fd00::/8", "0.0.0.0/0"])(
    "accepts %s",
    (value) => expect(isCidr(value)).toBe(true),
  );
  it.each(["10.0.0.0/33", "10.0.0/8", "fd00::/129", "lan", "10.0.0.0/8/1", ""])(
    "refuses %s",
    (value) => expect(isCidr(value)).toBe(false),
  );
});
