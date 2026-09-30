import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import type { Server } from "https";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as jose from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServicesListener } from "../../../src/auth/servicesListener";
import { issueAccessToken } from "../../../src/auth/tokens/accessTokens";
import { SigningKeyService } from "../../../src/auth/tokens/SigningKeyService";
import {
  ambientPush,
  graphQlWeatherStation,
  WEATHER_STATION_ID,
  WEATHER_STATION_MAC,
} from "../../fixtures/olympus";
import { devCa, identity, servicesConfig } from "../../support/devCa";
import { createTestApp, type TestApp } from "../../support/testApp";

const IMPORT = "/v1/olympus/weather/station/readings";

const record = (overrides: Record<string, unknown> = {}) => ({
  macAddress: WEATHER_STATION_MAC,
  receivedAt: "2026-09-29T20:00:03.000Z",
  source: "push",
  remote: "192.168.15.20",
  query: ambientPush(),
  ...overrides,
});

/**
 * ImportWeatherStationReadings: the dev relay agent's way in (ADR 0025),
 * over the services listener as an agent, both listeners enforcing.
 */
describe("ImportWeatherStationReadings", () => {
  let t: TestApp;
  let server: Server;
  let port: number;

  const asAgent = (body: unknown, name = "agents/dionysus-search-agent") =>
    new Promise<{ status?: number; body: string }>((resolve, reject) => {
      const payload = JSON.stringify(body);
      const request = https.request(
        {
          host: "127.0.0.1",
          port,
          path: IMPORT,
          method: "POST",
          servername: "localhost",
          ca: fs.readFileSync(path.join(devCa(), "services-ca.crt")),
          ...identity(name),
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
          },
        },
        (response) => {
          let text = "";
          response.on("data", (chunk) => (text += chunk));
          response.on("end", () =>
            resolve({ status: response.statusCode, body: text }),
          );
        },
      );
      request.on("error", reject);
      request.end(payload);
    });

  beforeAll(async () => {
    const keys = mkdtempSync(path.join(tmpdir(), "auth-keys-"));
    const { privateKey } = await jose.generateKeyPair("ES256", {
      extractable: true,
    });
    writeFileSync(
      path.join(keys, "2026-01-01.pem"),
      await jose.exportPKCS8(privateKey),
    );
    t = await createTestApp({
      env: {
        AUTH_SIGNING_KEYS: keys,
        AUTH_MODE_USERS: "enforce",
        AUTH_MODE_SERVICES: "enforce",
        // One agent with the role, one without.
        AUTH_SERVICE_ROLES:
          "dionysus-search-agent:agent,dionysus-asset-agent:content",
      },
    });
    server = createServicesListener(t.app, servicesConfig());
    await new Promise((resolve) => server.once("listening", resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    server.close();
    await t.close();
  });

  beforeEach(() => {
    t.reset();
    t.graphql.on("GetWeatherStationByMac", (vars) => ({
      olympus_weather_stations:
        (vars as { macAddress: string }).macAddress === WEATHER_STATION_MAC
          ? [graphQlWeatherStation()]
          : [],
    }));
    t.graphql.on("CreateWeatherStationSamples", (vars) => ({
      insert_olympus_weather_station_samples: {
        affected_rows: (vars as { objects: unknown[] }).objects.length,
      },
    }));
  });

  it("stores the lines with this API's parser, and says what became of each", async () => {
    const res = await asAgent({
      records: [
        record(),
        record({ query: ambientPush({ dateutc: "2026-09-29+20:00:00" }) }),
        record({
          macAddress: "0A:1B:2C:3D:4E:5F",
          query: ambientPush({ PASSKEY: "0A:1B:2C:3D:4E:5F" }),
        }),
        record({ query: ambientPush({ dateutc: "yesterday" }) }),
        record({ source: "backfill", query: undefined }),
        record({ source: "backfill", query: undefined, responseJson: "[]" }),
      ],
    });

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      stored: 2,
      duplicate: 0,
      unknownStation: 1,
      // The bad time, and the backfill line with no response.
      invalid: 2,
      skipped: 0,
    });
    const { objects } = t.graphql.calls("CreateWeatherStationSamples")[0]
      .variables as { objects: Record<string, unknown>[] };
    expect(objects.map((o) => o.stationId)).toEqual([
      WEATHER_STATION_ID,
      WEATHER_STATION_ID,
    ]);
    // A push replaces only a backfilled reading.
    expect(
      t.graphql.calls("CreateWeatherStationSamples")[0].variables,
    ).toMatchObject({ onConflict: { where: { source: { _eq: "backfill" } } } });
  });

  it("writes nothing to the archive and checks no address", async () => {
    // No WEATHER_STATION_ALLOWED_CIDRS at all: a push would be refused.
    const res = await asAgent({ records: [record({ remote: "10.0.0.1" })] });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).stored).toBe(1);
  });

  it.each([
    ["no records", {}],
    ["an empty list", { records: [] }],
    ["too many", { records: Array.from({ length: 501 }, () => record()) }],
    ["a MAC that is not one", { records: [record({ macAddress: "nope" })] }],
    ["no time", { records: [record({ receivedAt: undefined })] }],
    ["an unknown source", { records: [record({ source: "guess" })] }],
    ["a query that is not text", { records: [record({ query: 7 })] }],
    [
      "a response that is not JSON",
      { records: [record({ source: "backfill", responseJson: "{nope" })] },
    ],
  ])("answers 400 to %s, storing nothing", async (_case, body) => {
    const res = await asAgent(body);
    expect(res.status).toBe(400);
    expect(t.graphql.calls("CreateWeatherStationSamples")).toHaveLength(0);
  });

  it("answers 403 to a service without the agent role", async () => {
    const res = await asAgent(
      { records: [record()] },
      "agents/dionysus-asset-agent",
    );
    expect(res.status).toBe(403);
  });

  it("answers 403 to a signed-in user, even an admin", async () => {
    const token = await issueAccessToken(
      t.app.get(SigningKeyService).require(),
      {
        sub: "5f1a0c6e-0000-4000-8000-000000000001",
        clientId: "olympus-site",
        sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
        roles: ["user", "admin"],
        authTime: 1_790_000_000,
      },
    );
    const res = await t
      .http()
      .post(IMPORT)
      .set("authorization", `Bearer ${token}`)
      .send({ records: [record()] });
    expect(res.status).toBe(403);
  });

  it("answers 401 without any identity", async () => {
    const res = await t
      .http()
      .post(IMPORT)
      .send({ records: [record()] });
    expect(res.status).toBe(401);
  });
});
