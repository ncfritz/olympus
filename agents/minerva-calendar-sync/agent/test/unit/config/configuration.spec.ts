import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  readConfig,
} from "../../../src/config/configuration";

const REQUIRED = { OLYMPUS_API_URL: "http://olympus-api:3100/" };

describe("readConfig", () => {
  it("applies the defaults", () => {
    const config = readConfig(REQUIRED);
    expect(config.server).toMatchObject({
      port: 4432,
      appName: "minerva-calendar-sync-development",
    });
    expect(config.sync).toEqual({
      pollIntervalMs: 45_000,
      windowPastDays: 30,
      windowFutureDays: 180,
      historyRetentionDays: 90,
      webhookBaseUrl: undefined,
    });
    expect(config.outbox).toMatchObject({
      enabled: false,
      batchSize: 50,
      pollIntervalMs: 5_000,
      maxAttempts: 10,
    });
    expect(config.microsoft.tenantId).toBe("common");
    expect(config.google.credentialsDir).toMatch(/\.credentials$/);
    expect(config.auth).toMatchObject({
      baseUrl: "http://localhost:4432",
      olympus: {
        apiUrl: "http://olympus-api:3100",
        signInUrl: "http://olympus-api:3100",
      },
    });
  });

  it("reads the outbox broker from the AMQP variables", () => {
    const { outbox } = readConfig({
      ...REQUIRED,
      OUTBOX_ENABLED: "true",
      AMQP_HOST: "rabbit",
      AMQP_PASSWORD: "hunter2",
    });
    expect(outbox.enabled).toBe(true);
    expect(outbox.amqp.uri).toBe("amqp://admin:hunter2@rabbit:5672/%2F");
    expect(outbox.amqp.redactedUri).not.toContain("hunter2");
  });

  it("signs in where the browser reaches the API, when that differs", () => {
    const { auth } = readConfig({
      ...REQUIRED,
      OLYMPUS_SIGN_IN_URL: "https://olympus.ncfritz.net/api/",
    });
    expect(auth.olympus).toEqual({
      apiUrl: "http://olympus-api:3100",
      signInUrl: "https://olympus.ncfritz.net/api",
    });
  });

  it("needs to know where the API is", () => {
    expect(() => readConfig({})).toThrow(/OLYMPUS_API_URL is required/);
    expect(() => readConfig({ OLYMPUS_API_URL: "olympus-api" })).toThrow(
      /OLYMPUS_API_URL must be an http\(s\) URL/,
    );
  });

  it("has no services listener until its certificate is configured", () => {
    expect(readConfig(REQUIRED).auth.services).toBeUndefined();
  });

  it("reads the services listener with the API's variable names", () => {
    const { auth } = readConfig({
      ...REQUIRED,
      TLS_CERT: "agent.crt",
      TLS_KEY: "agent.key",
      TLS_CA_SERVICES: "services-ca.crt",
      TLS_CRL_SERVICES: "services.crl,root.crl",
      AUTH_SERVICES_ISSUER: "Service Issuing CA",
    });
    expect(auth.services).toEqual({
      port: 4433,
      certificate: "agent.crt",
      key: "agent.key",
      ca: "services-ca.crt",
      revocationLists: ["services.crl", "root.crl"],
      issuer: "Service Issuing CA",
      clients: ["olympus-api"],
    });
  });

  it("refuses part of the services listener's certificate", () => {
    expect(() => readConfig({ ...REQUIRED, TLS_CERT: "agent.crt" })).toThrow(
      /set together or not at all/,
    );
  });

  it("reports every problem at once", () => {
    try {
      readConfig({
        LISTEN_PORT: "web",
        POLL_INTERVAL_MS: "soon",
        OLYMPUS_SIGN_IN_URL: "ftp://olympus",
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).problems).toHaveLength(4);
    }
  });
});
