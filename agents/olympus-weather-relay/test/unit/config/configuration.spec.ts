import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  readConfig,
} from "../../../src/config/configuration";

const BASE = { AMQP_PASSWORD: "pw" };

describe("readConfig", () => {
  it("relays into olympus_dev on dev's vhost by default", () => {
    const config = readConfig(BASE);
    expect(config.relay).toEqual({ database: "olympus_dev" });
    expect(config.amqp.redactedUri).toContain("dionysus-dev");
    expect(config.runtime.appName).toMatch(/^olympus-weather-relay-agent/);
    // The certificate's name, in every environment.
    expect(config.runtime.serviceName).toBe("olympus-weather-relay-agent");
  });

  it("takes the database it feeds", () => {
    expect(
      readConfig({ ...BASE, WEATHER_RELAY_DATABASE: "olympus-laptop" }).relay
        .database,
    ).toBe("olympus-laptop");
  });

  it.each([["Olympus"], ["olympus dev"], ["a.b"], ["x".repeat(64)]])(
    "refuses the database %j",
    (database) => {
      expect(() =>
        readConfig({ ...BASE, WEATHER_RELAY_DATABASE: database }),
      ).toThrow(ConfigValidationError);
    },
  );

  it("needs a certificate for the API's services listener", () => {
    expect(() =>
      readConfig({ ...BASE, API_BASE_URL: "https://localhost:3443/v1" }),
    ).toThrow(/API_CLIENT_CERT/);
    const config = readConfig({
      ...BASE,
      API_BASE_URL: "https://localhost:3443/v1",
      API_CLIENT_CERT: "relay.crt",
      API_CLIENT_KEY: "relay.key",
    });
    expect(config.olympus.tls).toMatchObject({
      certificate: "relay.crt",
      key: "relay.key",
    });
  });
});
