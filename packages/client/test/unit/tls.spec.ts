import * as fs from "fs";
import * as https from "https";
import type { Server } from "https";
import type { TLSSocket } from "tls";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOlympusClients } from "../../src/clients";
import { type ClientTlsOptions, tlsAxiosOptions } from "../../src/tls";
import { devCaFile } from "../support/devCa";

/**
 * A service authenticating with its certificate (ADR 0018), against a
 * server that requires one the way the API's `3443` listener does.
 */
describe("the client TLS options", () => {
  let server: Server;
  let baseUrl: string;
  const callers: (string | undefined)[] = [];

  const agentTls = (
    name = "agents/dionysus-search-agent",
  ): ClientTlsOptions => ({
    certificate: devCaFile(`${name}.crt`),
    key: devCaFile(`${name}.key`),
    ca: devCaFile("services-ca.crt"),
  });

  /** The API client of a service, with or without its certificate. */
  const api = (tls?: ClientTlsOptions) =>
    createOlympusClients({
      baseUrl,
      clientName: "dionysus-search-agent",
      axios: {
        ...tlsAxiosOptions(tls),
        // Without a certificate, still trust the server: what fails then
        // is the client's own identity, not the server's.
        ...(tls ? {} : { httpsAgent: caOnly }),
      },
    }).olympus.instance;

  let caOnly: https.Agent;

  const connections = () =>
    new Promise<number>((resolve) =>
      server.getConnections((_, count) => resolve(count)),
    );

  beforeAll(async () => {
    caOnly = new https.Agent({
      ca: fs.readFileSync(devCaFile("services-ca.crt")),
    });
    server = https.createServer(
      {
        cert: fs.readFileSync(devCaFile("api.crt")),
        key: fs.readFileSync(devCaFile("api.key")),
        ca: fs.readFileSync(devCaFile("services-ca.crt")),
        requestCert: true,
        rejectUnauthorized: true,
      },
      (request, response) => {
        const name = (request.socket as TLSSocket).getPeerCertificate().subject
          ?.CN;
        callers.push(Array.isArray(name) ? name[0] : name);
        response.writeHead(200, { "content-type": "application/json" });
        response.end("{}");
      },
    );
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const { port } = server.address() as { port: number };
    baseUrl = `https://localhost:${port}/v1`;
  });

  afterAll(() => {
    server.close();
    caOnly.destroy();
  });

  it("presents the service's certificate", async () => {
    const response = await api(agentTls()).get("/olympus/ping");
    expect(response.status).toBe(200);
    expect(callers.at(-1)).toBe("dionysus-search-agent");
  });

  it("reuses one connection for every request", async () => {
    const client = api(agentTls());
    await client.get("/olympus/ping");
    const before = await connections();
    await client.get("/olympus/ping");
    await client.get("/olympus/ping");
    expect(await connections()).toBe(before);
  });

  it("is refused without a certificate", async () => {
    await expect(api().get("/olympus/ping")).rejects.toThrow();
  });

  it("adds nothing when the service has no certificate", () => {
    expect(tlsAxiosOptions(undefined)).toEqual({});
  });
});
