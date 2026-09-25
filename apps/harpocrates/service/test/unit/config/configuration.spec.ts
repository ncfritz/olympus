import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  readConfig,
} from "../../../src/config/configuration";

describe("readConfig", () => {
  it("defaults to a development service on 3200", () => {
    const config = readConfig({});
    expect(config.server).toMatchObject({
      nodeEnv: "development",
      isProduction: false,
      appName: "harpocrates-development",
      port: 3200,
      apiExplorer: true,
    });
  });

  it("keeps the API explorer off in production unless asked", () => {
    expect(readConfig({ NODE_ENV: "production" }).server).toMatchObject({
      appName: "harpocrates",
      apiExplorer: false,
    });
    expect(
      readConfig({ NODE_ENV: "production", ENABLE_API_EXPLORER: "true" }).server
        .apiExplorer,
    ).toBe(true);
  });

  it("lists every invalid variable", () => {
    expect(() =>
      readConfig({ LISTEN_PORT: "not-a-port", CONSOLE_LOGGING_LEVEL: "loud" }),
    ).toThrow(ConfigValidationError);
  });
});
