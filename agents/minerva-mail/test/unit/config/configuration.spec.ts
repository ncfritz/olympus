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

  it("refuses a port that is not one", () => {
    expect(() => readConfig({ LISTEN_PORT: "mail" })).toThrow(
      ConfigValidationError,
    );
  });
});
