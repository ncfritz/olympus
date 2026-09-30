import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as jose from "jose";
import type { Moment } from "moment";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { issueAccessToken } from "../../../src/auth/tokens/accessTokens";
import { SigningKeyService } from "../../../src/auth/tokens/SigningKeyService";
import { AmbientClient } from "../../../src/olympus/weather/providers/AmbientClient";
import { WeatherBackfillService } from "../../../src/olympus/weather/services/WeatherBackfillService";
import {
  graphQlWeatherStation,
  WEATHER_STATION_ID,
  WEATHER_STATION_MAC,
} from "../../fixtures/olympus";
import { createTestApp, type TestApp } from "../../support/testApp";

const BACKFILL = "/v1/olympus/weather/stations/backfill";

/**
 * BackfillWeatherStations over the real HTTP stack, with ambientweather.net
 * stood in for: backfill on, as in prod.
 */
describe("BackfillWeatherStations", () => {
  let t: TestApp;
  let archive: string;
  let adminToken: string;
  let userToken: string;
  const deviceData = vi.fn();

  const tokenFor = (roles: string[]) =>
    issueAccessToken(t.app.get(SigningKeyService).require(), {
      sub: "5f1a0c6e-0000-4000-8000-000000000001",
      clientId: "olympus-site",
      sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
      roles,
      authTime: 1_790_000_000,
    });

  const backfill = (token: string, body: object) =>
    t.http().post(BACKFILL).set("authorization", `Bearer ${token}`).send(body);

  const settled = () =>
    vi.waitFor(
      () => expect(t.app.get(WeatherBackfillService).running).toBe(false),
      { timeout: 2000 },
    );

  beforeAll(async () => {
    const keys = mkdtempSync(join(tmpdir(), "auth-keys-"));
    archive = mkdtempSync(join(tmpdir(), "weather-archive-"));
    const { privateKey } = await jose.generateKeyPair("ES256", {
      extractable: true,
    });
    writeFileSync(
      join(keys, "2026-01-01.pem"),
      await jose.exportPKCS8(privateKey),
    );
    t = await createTestApp({
      env: {
        AUTH_SIGNING_KEYS: keys,
        AUTH_MODE_USERS: "enforce",
        WEATHER_ARCHIVE_DIR: archive,
        WEATHER_BACKFILL_ENABLED: "true",
      },
      overrides: [
        {
          provide: AmbientClient,
          useValue: { configured: true, deviceData },
        },
      ],
    });
    adminToken = await tokenFor(["user", "admin"]);
    userToken = await tokenFor(["user"]);
  });

  afterAll(async () => {
    await t.close();
    rmSync(archive, { recursive: true, force: true });
  });

  beforeEach(() => {
    t.reset();
    deviceData.mockReset();
    t.graphql.on("ListWeatherStations", {
      olympus_weather_stations: [graphQlWeatherStation()],
    });
    t.graphql.on("DescribeWeatherStation", (vars) => ({
      olympus_weather_stations_by_pk:
        (vars as { stationId: string }).stationId === WEATHER_STATION_ID
          ? graphQlWeatherStation()
          : null,
    }));
    t.graphql.on("GetWeatherStationByMac", {
      olympus_weather_stations: [graphQlWeatherStation()],
    });
    t.graphql.on("CreateWeatherStationSamples", (vars) => ({
      insert_olympus_weather_station_samples: {
        affected_rows: (vars as { objects: unknown[] }).objects.length,
      },
    }));
    t.graphql.on("ListWeatherRollupTiers", {
      olympus_weather_rollup_tiers: [
        { name: "1m", bucket: "00:01:00", sourceTier: null, builtUntil: null },
      ],
    });
    t.graphql.on("RollupWeatherSamples", {
      olympus_weather_rollup_samples: [
        { tier: "1m", rowsWritten: 1, rowsPruned: 0 },
      ],
    });
  });

  it("fetches the days in the background, storing the records as backfill", async () => {
    deviceData.mockImplementation(async (_mac: string, end: Moment) =>
      end.toISOString() === "2026-08-02T00:00:00.000Z"
        ? [
            { dateutc: Date.parse("2026-08-01T23:55:00Z"), tempf: 61.2 },
            { dateutc: Date.parse("2026-08-01T00:00:00Z"), tempf: 55.0 },
          ]
        : [],
    );

    const res = await backfill(adminToken, {
      backfill: { from: "2026-08-01", to: "2026-08-01" },
    });

    expect(res.status).toBe(202);
    await settled();
    expect(deviceData).toHaveBeenCalledWith(
      WEATHER_STATION_MAC,
      expect.anything(),
    );
    const { objects } = t.graphql.calls("CreateWeatherStationSamples")[0]
      .variables as { objects: Record<string, unknown>[] };
    expect(
      objects.map((o) => [o.observedTime, o.source, o.outdoorTemperatureF]),
    ).toEqual([
      ["2026-08-01T23:55:00.000Z", "backfill", 61.2],
      ["2026-08-01T00:00:00.000Z", "backfill", 55],
    ]);
    // A backfilled record never replaces what is stored.
    expect(
      t.graphql.calls("CreateWeatherStationSamples")[0].variables,
    ).toMatchObject({ onConflict: { update_columns: [] } });
    expect(t.graphql.calls("RollupWeatherSamples")[0].variables).toEqual({
      fromTime: "2026-08-01T00:00:00.000Z",
      toTime: "2026-08-02T00:00:00.000Z",
    });
  });

  it("answers 404 for a station that is not there, before starting", async () => {
    const res = await backfill(adminToken, {
      backfill: {
        from: "2026-08-01",
        to: "2026-08-01",
        stationId: "3b6f1d2c-0000-4000-8000-0000000000ff",
      },
    });
    expect(res.status).toBe(404);
    expect(deviceData).not.toHaveBeenCalled();
  });

  it("answers 400 to a range that is not one", async () => {
    const res = await backfill(adminToken, {
      backfill: { from: "2026-08-02", to: "2026-08-01" },
    });
    expect(res.status).toBe(400);
  });

  it("answers 409 while one is running", async () => {
    let release: () => void = () => undefined;
    deviceData.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve([]);
        }),
    );
    const body = { backfill: { from: "2026-08-01", to: "2026-08-01" } };
    expect((await backfill(adminToken, body)).status).toBe(202);
    expect((await backfill(adminToken, body)).status).toBe(409);
    release();
    await settled();
  });

  it("is an admin's", async () => {
    const res = await backfill(userToken, {
      backfill: { from: "2026-08-01", to: "2026-08-01" },
    });
    expect(res.status).toBe(403);
  });
});
