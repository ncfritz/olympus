import { describe, expect, it } from "vitest";
import {
  EnvReader,
  readAmqpConfig,
  readLoggingConfig,
  readRuntimeConfig,
} from "../../../src";

describe("EnvReader", () => {
  it("collects every problem", () => {
    const read = new EnvReader({ PORT: "x", FLAG: "yes", MODE: "c" });
    read.port("PORT", 1);
    read.boolean("FLAG", false);
    read.oneOf("MODE", ["a", "b"], "a");
    read.string("REQUIRED");
    expect(read.problems).toEqual([
      'PORT must be a port number, got "x"',
      'FLAG must be "true" or "false", got "yes"',
      'MODE must be one of a, b, got "c"',
      "REQUIRED is required",
    ]);
  });

  it("treats empty values as unset", () => {
    const read = new EnvReader({ A: "  ", LIST: "a, b,," });
    expect(read.string("A", "fallback")).toBe("fallback");
    expect(read.optional("A")).toBeUndefined();
    expect(read.list("LIST", [])).toEqual(["a", "b"]);
  });
});

describe("readRuntimeConfig", () => {
  it("suffixes the app name outside production", () => {
    expect(readRuntimeConfig(new EnvReader({}), "agent", 3100)).toEqual({
      nodeEnv: "development",
      isProduction: false,
      appName: "agent-development",
      port: 3100,
    });
    expect(
      readRuntimeConfig(new EnvReader({ NODE_ENV: "production" }), "agent", 1)
        .appName,
    ).toBe("agent");
  });
});

describe("readAmqpConfig", () => {
  it("masks the password in the redacted URI", () => {
    const amqp = readAmqpConfig(
      new EnvReader({ AMQP_USER: "u", AMQP_PASSWORD: "s3cret" }),
      "/vhost",
    );
    expect(amqp.uri).toBe("amqp://u:s3cret@localhost:5672/%2Fvhost");
    expect(amqp.redactedUri).toBe("amqp://u:***@localhost:5672/%2Fvhost");
  });
});

describe("readLoggingConfig", () => {
  it("logs to the console in development and to files in production", () => {
    const dev = readLoggingConfig(new EnvReader({}), false);
    const prod = readLoggingConfig(new EnvReader({}), true);
    expect([dev.console.enabled, dev.file.enabled]).toEqual([true, false]);
    expect([prod.console.enabled, prod.file.enabled]).toEqual([false, true]);
  });
});
