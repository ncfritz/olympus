import * as fs from "fs";
import * as https from "https";
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
