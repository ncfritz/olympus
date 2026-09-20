import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  readConfig,
} from "../../../src/config/configuration";

describe("readConfig", () => {
  it("applies the defaults", () => {
    const config = readConfig({});
    expect(config.runtime.appName).toBe("dionysus-search-agent-development");
    expect(config.runtime.port).toBe(3100);
    expect(config.amqp.redactedUri).toBe(
      "amqp://admin:***@localhost:5672/%2Fdionysus-dev",
    );
    expect(config.olympus).toEqual({
      baseUrl: "http://localhost:3001/v1",
    });
    expect(config.nzbGeek).toEqual({
      apiUrl: "https://api.nzbgeek.info/api",
      apiKey: undefined,
    });
  });

  it("presents its certificate on the API's mTLS listener", () => {
    const { olympus } = readConfig({
      API_BASE_URL: "https://olympus-api:3443/v1",
      API_CLIENT_CERT: "/certs/dionysus-search-agent.crt",
      API_CLIENT_KEY: "/certs/dionysus-search-agent.key",
      API_CA_CERT: "/certs/services-ca.crt",
    });
    expect(olympus.baseUrl).toBe("https://olympus-api:3443/v1");
    expect(olympus.tls).toEqual({
      certificate: "/certs/dionysus-search-agent.crt",
      key: "/certs/dionysus-search-agent.key",
      ca: "/certs/services-ca.crt",
    });
  });

  it("reads the indexer key", () => {
    expect(readConfig({ NZBGEEK_API_KEY: "key" }).nzbGeek.apiKey).toBe("key");
  });

  it("never puts the AMQP password in the loggable URI", () => {
    const { amqp } = readConfig({ AMQP_PASSWORD: "hunter2" });
    expect(amqp.uri).toContain("hunter2");
    expect(amqp.redactedUri).not.toContain("hunter2");
  });

  it("reports every problem at once", () => {
    try {
      readConfig({ LISTEN_PORT: "metrics", AMQP_PROTOCOL: "http" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).problems).toHaveLength(2);
    }
  });
});
