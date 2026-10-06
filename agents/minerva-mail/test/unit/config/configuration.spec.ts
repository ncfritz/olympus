import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  readConfig,
} from "../../../src/config/configuration";

describe("readConfig", () => {
  it("names the agent and listens on 3105 by default", () => {
    const config = readConfig({});
    expect(config.runtime.appName).toMatch(/^minerva-mail-agent/);
    // The certificate's name, in every environment.
    expect(config.runtime.serviceName).toBe("minerva-mail-agent");
    expect(config.runtime.port).toBe(3105);
  });

  it("publishes on dev's vhost and calls the local API by default", () => {
    const config = readConfig({ AMQP_PASSWORD: "pw" });
    expect(config.amqp.redactedUri).toContain("dionysus-dev");
    expect(config.amqp.redactedUri).not.toContain("pw");
    expect(config.olympus.baseUrl).toBe("http://localhost:3100/v1");
  });

  it("needs a certificate for the API's services listener", () => {
    expect(() =>
      readConfig({ API_BASE_URL: "https://localhost:3443/v1" }),
    ).toThrow(/API_CLIENT_CERT/);
    const config = readConfig({
      API_BASE_URL: "https://localhost:3443/v1",
      API_CLIENT_CERT: "mail.crt",
      API_CLIENT_KEY: "mail.key",
    });
    expect(config.olympus.tls).toMatchObject({
      certificate: "mail.crt",
      key: "mail.key",
    });
  });

  it("has no classifier until MAIL_ML_URL is set", () => {
    expect(readConfig({}).classifier).toBeUndefined();
  });

  it("calls the classifier with the agent's own certificate by default", () => {
    const config = readConfig({
      API_BASE_URL: "https://localhost:3443/v1",
      API_CLIENT_CERT: "mail.crt",
      API_CLIENT_KEY: "mail.key",
      API_CA_CERT: "services-ca.crt",
      MAIL_ML_URL: "https://localhost:3107/v1",
    });
    expect(config.classifier).toEqual({
      baseUrl: "https://localhost:3107/v1",
      tls: { certificate: "mail.crt", key: "mail.key", ca: "services-ca.crt" },
      timeoutMs: 60000,
    });
  });

  it("takes a certificate of the classifier's own", () => {
    const config = readConfig({
      MAIL_ML_URL: "https://localhost:3107/v1",
      MAIL_ML_CLIENT_CERT: "a.crt",
      MAIL_ML_CLIENT_KEY: "a.key",
      MAIL_ML_TIMEOUT_MS: "5000",
    });
    expect(config.classifier).toMatchObject({
      tls: { certificate: "a.crt", key: "a.key" },
      timeoutMs: 5000,
    });
  });

  it.each([
    [
      "plain HTTP",
      {
        MAIL_ML_URL: "http://localhost:3107/v1",
        MAIL_ML_CLIENT_CERT: "a",
        MAIL_ML_CLIENT_KEY: "b",
      },
      /mutual TLS/,
    ],
    [
      "no certificate",
      { MAIL_ML_URL: "https://localhost:3107/v1" },
      /client certificate/,
    ],
    [
      "a timeout that is not one",
      {
        MAIL_ML_URL: "https://localhost:3107/v1",
        MAIL_ML_CLIENT_CERT: "a",
        MAIL_ML_CLIENT_KEY: "b",
        MAIL_ML_TIMEOUT_MS: "soon",
      },
      /MAIL_ML_TIMEOUT_MS/,
    ],
  ])("refuses a classifier with %s", (_case, env, reason) => {
    expect(() => readConfig(env)).toThrow(reason);
  });

  it("refuses a port that is not one", () => {
    expect(() => readConfig({ LISTEN_PORT: "mail" })).toThrow(
      ConfigValidationError,
    );
  });
});

describe("Gmail and the services listener", () => {
  it("has neither until they are configured", () => {
    const config = readConfig({});
    expect(config.gmail).toBeUndefined();
    expect(config.services).toBeUndefined();
  });

  it("reads Gmail's client, the secret from a file", () => {
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "s-")),
      "secret",
    );
    fs.writeFileSync(file, "the-secret\n");
    const config = readConfig({
      MAIL_GOOGLE_OAUTH_CLIENT_ID: "id.apps.googleusercontent.com",
      MAIL_GOOGLE_OAUTH_CLIENT_SECRET_FILE: file,
    });
    expect(config.gmail).toMatchObject({
      clientId: "id.apps.googleusercontent.com",
      clientSecret: "the-secret",
      credentialsDir: "data/credentials",
      scopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.readonly",
      ],
    });
  });

  it("needs both halves of Gmail's client", () => {
    expect(() => readConfig({ MAIL_GOOGLE_OAUTH_CLIENT_ID: "id" })).toThrow(
      /together/,
    );
  });

  it("reads the services listener, for the API alone by default", () => {
    const config = readConfig({
      TLS_CERT: "a.crt",
      TLS_KEY: "a.key",
      TLS_CA_SERVICES: "ca.crt",
      TLS_CRL_SERVICES: "one.crl,two.crl",
      AUTH_SERVICES_ISSUER: "Service Issuing CA",
    });
    expect(config.services).toEqual({
      port: 4435,
      certificate: "a.crt",
      key: "a.key",
      ca: "ca.crt",
      revocationLists: ["one.crl", "two.crl"],
      issuer: "Service Issuing CA",
      clients: ["olympus-api"],
    });
  });

  it("needs the listener's three files together", () => {
    expect(() => readConfig({ TLS_CERT: "a.crt" })).toThrow(/together/);
  });
});
