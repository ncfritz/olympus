import { execFileSync } from "child_process";
import * as fs from "fs";
import * as https from "https";
import * as os from "os";
import * as path from "path";
import type { Server } from "https";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServicesListener } from "../../src/auth/servicesListener";
import { devCa, identity, servicesConfig } from "../support/devCa";
import { createTestApp, type TestApp } from "../support/testApp";

type Call = {
  cert?: Buffer;
  key?: Buffer;
  headers?: Record<string, string>;
};

/**
 * The services listener (ADR 0018): a client certificate from the Olympus
 * Services chain is the caller's identity, and the handshake refuses
 * anything else before the application sees it.
 */
describe("the services listener", () => {
  let t: TestApp;
  let server: Server;
  let port: number;

  const call = (options: Call, url = "/v1/olympus/ping") =>
    new Promise<{ status?: number; body?: string; error?: string }>(
      (resolve) => {
        https
          .get(
            {
              host: "127.0.0.1",
              port,
              path: url,
              servername: "localhost",
              ca: fs.readFileSync(path.join(devCa(), "services-ca.crt")),
              cert: options.cert,
              key: options.key,
              headers: options.headers,
            },
            (response) => {
              let body = "";
              response.on("data", (chunk) => (body += chunk));
              response.on("end", () =>
                resolve({ status: response.statusCode, body }),
              );
            },
          )
          .on("error", (error: NodeJS.ErrnoException) =>
            resolve({ error: error.code ?? error.message }),
          );
      },
    );

  const decisions = async () =>
    (await t.http().get("/metrics").expect(200)).text;

  beforeAll(async () => {
    process.env.AUTH_SERVICE_ROLES =
      "dionysus-search-agent:agent,dionysus-asset-agent:agent|content";
    t = await createTestApp();
    server = createServicesListener(t.app, servicesConfig());
    await new Promise((resolve) => server.once("listening", resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    server.close();
    await t.app.close();
    delete process.env.AUTH_SERVICE_ROLES;
  });

  it("serves a request with a valid service certificate", async () => {
    const response = await call(identity("agents/dionysus-search-agent"));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toHaveProperty("config");
  });

  it("records the caller as its certificate, not its header", async () => {
    await call({
      ...identity("agents/dionysus-asset-agent"),
      headers: { "x-olympus-client": "dionysus-asset-agent" },
    });

    const metrics = await decisions();
    expect(metrics).toMatch(
      /^http_server_request_duration_seconds_count\{[^}]*client="dionysus-asset-agent"[^}]*operation="Ping"/m,
    );
    expect(metrics).toMatch(
      /^auth_decisions_total\{[^}]*listener="services",outcome="allow"[^}]*\} [1-9]/m,
    );
  });

  it("identifies the deployment from the certificate", async () => {
    // The NAS asset agent: the same common name, a different unit.
    const response = await call(identity("agents/dionysus-asset-agent-nas"));
    expect(response.status).toBe(200);
  });

  it.each([
    ["revoked", "agents/svc-revoked"],
    ["expired", "agents/svc-expired"],
    ["signed by the devices intermediate", "agents/svc-wrong-ca"],
    ["a device certificate", "devices/dev-valid"],
  ])("refuses a %s certificate during the handshake", async (_, name) => {
    const response = await call(identity(name));
    expect(response.status).toBeUndefined();
    expect(response.error).toBeDefined();
  });

  it("refuses a connection without a certificate", async () => {
    const response = await call({});
    expect(response.status).toBeUndefined();
    expect(response.error).toBeDefined();
  });

  it("would reject a service the configuration does not know", async () => {
    const response = await call(identity("agents/olympus-notification-agent"));

    // Report mode: the request is served and the decision recorded.
    expect(response.status).toBe(200);
    expect(await decisions()).toMatch(
      /^auth_decisions_total\{[^}]*listener="services",outcome="would_reject",reason="unknown service"[^}]*\} [1-9]/m,
    );
  });

  it("would reject a client header that is not the certificate", async () => {
    const response = await call({
      ...identity("agents/dionysus-search-agent"),
      headers: { "x-olympus-client": "olympus-site" },
    });

    expect(response.status).toBe(200);
    expect(await decisions()).toMatch(
      /^auth_decisions_total\{[^}]*outcome="would_reject",reason="client header mismatch"[^}]*\} [1-9]/m,
    );
  });
});

/**
 * Harpocrates publishes each list as DER and replaces it by renaming a new
 * file over it (ADR 0020); the listener reloads every replacement.
 */
describe("the services listener's revocation lists", () => {
  let t: TestApp;
  let server: Server;
  let port: number;
  let dir: string;
  let servicesList: string;

  const connect = (name: string) =>
    new Promise<number | string>((resolve) => {
      https
        .get(
          {
            host: "127.0.0.1",
            port,
            path: "/v1/olympus/ping",
            servername: "localhost",
            ca: fs.readFileSync(path.join(devCa(), "services-ca.crt")),
            ...identity(name),
            agent: false,
          },
          (response) => {
            response.resume();
            resolve(response.statusCode ?? 0);
          },
        )
        .on("error", (error: NodeJS.ErrnoException) =>
          resolve(error.code ?? error.message),
        );
    });

  /** As Harpocrates publishes: written beside, then renamed over. */
  const publish = (data: Buffer) => {
    fs.writeFileSync(`${servicesList}.tmp`, data);
    fs.renameSync(`${servicesList}.tmp`, servicesList);
  };

  const eventually = async (check: () => Promise<boolean>) => {
    for (let i = 0; i < 50; i += 1) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("not within 5 seconds");
  };

  /** The Service CA's list with one more certificate revoked, DER. */
  const listRevoking = (name: string): Buffer => {
    const authority = path.join(dir, "services");
    fs.cpSync(path.resolve(devCa(), "../services"), authority, {
      recursive: true,
    });
    const config = path.join(authority, "openssl.cnf");
    fs.writeFileSync(
      config,
      fs
        .readFileSync(config, "utf8")
        .replace(/^dir\s*=.*$/m, `dir = ${authority}`),
    );
    const run = (...args: string[]) =>
      execFileSync("openssl", args, {
        stdio: "ignore",
        // The configuration's server extensions read it.
        env: { ...process.env, SAN: "DNS:localhost" },
      });
    run(
      "ca",
      "-batch",
      "-config",
      config,
      "-revoke",
      path.join(devCa(), `${name}.crt`),
    );
    run(
      "ca",
      "-batch",
      "-config",
      config,
      "-gencrl",
      "-out",
      path.join(dir, "next.pem"),
    );
    run(
      "crl",
      "-in",
      path.join(dir, "next.pem"),
      "-outform",
      "DER",
      "-out",
      path.join(dir, "next.der"),
    );
    return fs.readFileSync(path.join(dir, "next.der"));
  };

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "api-crl-"));
    const config = servicesConfig();
    servicesList = path.join(dir, "services.crl");
    fs.copyFileSync(config.revocationLists[0], servicesList);
    t = await createTestApp();
    server = createServicesListener(
      t.app,
      {
        ...config,
        revocationLists: [servicesList, ...config.revocationLists.slice(1)],
      },
      50,
    );
    await new Promise((resolve) => server.once("listening", resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    server.close();
    await t.app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("takes a DER list renamed over the old one, and the next one too", async () => {
    const original = fs.readFileSync(servicesList);
    expect(await connect("agents/dionysus-search-agent")).toBe(200);

    publish(listRevoking("agents/dionysus-search-agent"));
    await eventually(
      async () => (await connect("agents/dionysus-search-agent")) !== 200,
    );

    publish(original);
    await eventually(
      async () => (await connect("agents/dionysus-search-agent")) === 200,
    );
  });
});
