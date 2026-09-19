import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  readConfig,
} from "../../../src/config/configuration";

describe("readConfig", () => {
  it("applies the defaults", () => {
    const config = readConfig({});
    expect(config.runtime.appName).toBe("dionysus-metadata-agents-development");
    expect(config.runtime.port).toBe(3100);
    expect(config.amqp.redactedUri).toBe(
      "amqp://admin:***@localhost:5672/%2Fdionysus-dev",
    );
    expect(config.olympus).toEqual({ apiBaseUrl: "http://localhost:3001/v1" });
    expect(config.tmdb).toEqual({ apiKey: undefined });
    expect(config.cache).toEqual({ path: undefined });
  });

  it("reads the TMDB key and cache path", () => {
    const config = readConfig({
      TMDB_API_KEY: "token",
      DIONYSUS_CACHE_PATH: "/cache",
    });
    expect(config.tmdb.apiKey).toBe("token");
    expect(config.cache.path).toBe("/cache");
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
