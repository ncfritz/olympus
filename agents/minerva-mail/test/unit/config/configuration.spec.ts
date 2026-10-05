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

  it("refuses a port that is not one", () => {
    expect(() => readConfig({ LISTEN_PORT: "mail" })).toThrow(
      ConfigValidationError,
    );
  });
});
