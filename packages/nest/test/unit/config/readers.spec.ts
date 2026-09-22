import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  EnvReader,
  readAmqpConfig,
  readApiClientConfig,
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

  it("lets a container log to the console and not to files in production", () => {
    const container = readLoggingConfig(
      new EnvReader({
        ENABLE_CONSOLE_LOGGING: "true",
        FILE_LOGGING_ENABLED: "false",
      }),
      true,
    );
    expect([container.console.enabled, container.file.enabled]).toEqual([
      true,
      false,
    ]);
  });
});

describe("EnvReader: values from files", () => {
  const secret = (content: string) => {
    const path = join(mkdtempSync(join(tmpdir(), "env-reader-")), "secret");
    writeFileSync(path, content);
    return path;
  };

  it("reads NAME_FILE when NAME is unset, without the trailing newline", () => {
    const read = new EnvReader({ AMQP_PASSWORD_FILE: secret("s3cret\n") });
    expect(read.string("AMQP_PASSWORD")).toBe("s3cret");
    expect(read.problems).toEqual([]);
  });

  it("feeds every typed reader", () => {
    const read = new EnvReader({ PORT_FILE: secret("5672\n") });
    expect(read.port("PORT", 1)).toBe(5672);
  });

  it("treats an empty file as unset", () => {
    const read = new EnvReader({ KEY_FILE: secret("\n") });
    expect(read.optional("KEY")).toBeUndefined();
    expect(read.string("KEY", "fallback")).toBe("fallback");
  });

  it("refuses both NAME and NAME_FILE", () => {
    const read = new EnvReader({ KEY: "a", KEY_FILE: secret("b") });
    expect(read.string("KEY")).toBe("a");
    expect(read.problems).toEqual(["KEY and KEY_FILE are both set; use one"]);
  });

  it("reports a file it cannot read", () => {
    const read = new EnvReader({ KEY_FILE: "/run/secrets/missing" });
    expect(read.optional("KEY")).toBeUndefined();
    expect(read.problems).toEqual([
      "KEY_FILE: cannot read /run/secrets/missing (ENOENT)",
    ]);
  });

  it("still reports a required value as missing", () => {
    const read = new EnvReader({ KEY_FILE: secret("") });
    read.string("KEY");
    expect(read.problems).toEqual(["KEY is required"]);
  });
});

describe("readApiClientConfig", () => {
  const read = (env: Record<string, string>) => {
    const reader = new EnvReader(env);
    return {
      config: readApiClientConfig(reader, "http://api:3100/v1"),
      reader,
    };
  };

  it("falls back to the plain base URL", () => {
    const { config, reader } = read({});
    expect(config).toEqual({ baseUrl: "http://api:3100/v1" });
    expect(reader.problems).toEqual([]);
  });

  it("reads the certificate the service presents", () => {
    const { config, reader } = read({
      API_BASE_URL: "https://olympus-api:3443/v1",
      API_CLIENT_CERT: "/certs/agent.crt",
      API_CLIENT_KEY: "/certs/agent.key",
      API_CA_CERT: "/certs/services-ca.crt",
    });
    expect(config).toEqual({
      baseUrl: "https://olympus-api:3443/v1",
      tls: {
        certificate: "/certs/agent.crt",
        key: "/certs/agent.key",
        ca: "/certs/services-ca.crt",
      },
    });
    expect(reader.problems).toEqual([]);
  });

  it("refuses half a certificate", () => {
    expect(
      read({ API_CLIENT_CERT: "/certs/agent.crt" }).reader.problems,
    ).toEqual(["API_CLIENT_CERT and API_CLIENT_KEY are set together"]);
  });

  it("refuses an https API without one", () => {
    expect(
      read({ API_BASE_URL: "https://olympus-api:3443/v1" }).reader.problems,
    ).toEqual([
      "API_CLIENT_CERT and API_CLIENT_KEY are required for an https API_BASE_URL",
    ]);
  });
});
