import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  readConfig,
} from "../../../src/config/configuration";

const REQUIRED = { AUTH_JWT_SECRET: "secret" };

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
      oidcProviders: [],
      allowedEmails: [],
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

  it("parses the login providers and lower-cases the allowlist", () => {
    const { auth } = readConfig({
      ...REQUIRED,
      AUTH_OIDC_PROVIDERS: JSON.stringify([
        {
          name: "google",
          issuer: "https://i",
          clientId: "c",
          clientSecret: "s",
        },
      ]),
      AUTH_ALLOWED_EMAILS: "Alice@Example.com, bob@example.com",
    });
    expect(auth.oidcProviders.map((p) => p.name)).toEqual(["google"]);
    expect(auth.allowedEmails).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
  });

  it("reports every problem at once", () => {
    try {
      readConfig({
        LISTEN_PORT: "web",
        POLL_INTERVAL_MS: "soon",
        AUTH_OIDC_PROVIDERS: "not json",
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).problems).toHaveLength(4);
    }
  });
});
