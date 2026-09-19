import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
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
