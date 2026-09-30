import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as jose from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { issueAccessToken } from "../../../src/auth/tokens/accessTokens";
import { SigningKeyService } from "../../../src/auth/tokens/SigningKeyService";
import { WeatherReplayService } from "../../../src/olympus/weather/services/WeatherReplayService";
import {
  ambientPush,
  graphQlWeatherStation,
  WEATHER_STATION_ID,
  WEATHER_STATION_MAC,
} from "../../fixtures/olympus";
import { createTestApp, type TestApp } from "../../support/testApp";

const USER = "5f1a0c6e-0000-4000-8000-000000000001";
const REPORT = "/v1/olympus/weather/station/report";

/**
 * Stations over the real HTTP stack, users' auth enforced so the admin
 * role is. Pushes come through a trusted proxy (loopback, as nginx is to
 * the API), so the address checked is the forwarded one.
 */
describe("Weather stations API", () => {
  let t: TestApp;
  let archive: string;
  let userToken: string;
  let adminToken: string;

  const tokenFor = (roles: string[]) =>
    issueAccessToken(t.app.get(SigningKeyService).require(), {
      sub: USER,
      clientId: "olympus-site",
      sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
      roles,
      authTime: 1_790_000_000,
    });

  const push = (from: string, overrides: Record<string, string> = {}) =>
    t
      .http()
      // The console's path ends in `?`; it appends `&PASSKEY=…`.
      .get(`${REPORT}?${ambientPush(overrides)}`)
      .set("x-forwarded-for", from);

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
        TRUSTED_PROXIES: "loopback",
        WEATHER_STATION_ALLOWED_CIDRS: "192.168.15.0/24,192.168.0.0/24",
        WEATHER_ARCHIVE_DIR: archive,
      },
    });
    userToken = await tokenFor(["user"]);
    adminToken = await tokenFor(["user", "admin"]);
  });

  afterAll(async () => {
    await t.close();
    rmSync(archive, { recursive: true, force: true });
  });

  beforeEach(() => t.reset());

  describe("ReportWeatherStationReading", () => {
    // One lookup per MAC is cached for a minute, so every test registers
    // the same answer rather than relying on order.
    beforeEach(() => {
      t.graphql.on("GetWeatherStationByMac", (vars) => ({
        olympus_weather_stations:
          (vars as { macAddress: string }).macAddress === WEATHER_STATION_MAC
            ? [graphQlWeatherStation()]
            : [],
      }));
      t.graphql.on("CreateWeatherStationSamples", {
        insert_olympus_weather_station_samples: { affected_rows: 1 },
      });
    });

    it("stores a registered console's push, without a token", async () => {
      const res = await push("192.168.15.20");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
      const [object] = (
        t.graphql.calls("CreateWeatherStationSamples")[0].variables as {
          objects: Record<string, unknown>[];
        }
      ).objects;
      expect(object).toMatchObject({
        stationId: WEATHER_STATION_ID,
        observedTime: "2026-09-29T19:59:44.000Z",
        source: "push",
        outdoorTemperatureF: 58.1,
        indoorTemperatureF: 70.3,
        pressureRelativeInhg: 29.94,
      });
    });

    it("archives the query string exactly as the console sent it", async () => {
      await push("192.168.0.31");

      const month = join(archive, "A0-B1-C2-D3-E4-F5");
      const [year] = readdirSync(month);
      const [monthDir] = readdirSync(join(month, year));
      const [day] = readdirSync(join(month, year, monthDir)).filter((name) =>
        name.endsWith(".jsonl"),
      );
      const lines = readFileSync(join(month, year, monthDir, day), "utf8")
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(lines.at(-1)).toMatchObject({
        source: "push",
        remote: "192.168.0.31",
        query: ambientPush(),
      });
    });

    it("answers 200 for a repeat, storing it once", async () => {
      t.graphql.on("CreateWeatherStationSamples", {
        insert_olympus_weather_station_samples: { affected_rows: 0 },
      });
      const res = await push("192.168.15.20");
      expect(res.status).toBe(200);
    });

    it("answers 403 to an address outside the ranges, asking Hasura nothing", async () => {
      const res = await push("10.1.2.3");
      expect(res.status).toBe(403);
      expect(t.graphql.calls("GetWeatherStationByMac")).toHaveLength(0);
      expect(t.graphql.calls("CreateWeatherStationSamples")).toHaveLength(0);
    });

    it("answers 403 to a console that is not registered", async () => {
      const res = await push("192.168.15.20", { PASSKEY: "0A:1B:2C:3D:4E:5F" });
      expect(res.status).toBe(403);
      expect(t.graphql.calls("CreateWeatherStationSamples")).toHaveLength(0);
    });

    it("answers 400 to a push without a usable time", async () => {
      const res = await push("192.168.15.20", { dateutc: "yesterday" });
      expect(res.status).toBe(400);
      expect(t.graphql.calls("CreateWeatherStationSamples")).toHaveLength(0);
    });
  });

  describe("without an identity", () => {
    it.each([
      ["get", "/v1/olympus/weather/stations"],
      ["post", "/v1/olympus/weather/stations"],
      ["get", `/v1/olympus/weather/station/${WEATHER_STATION_ID}`],
      ["put", `/v1/olympus/weather/station/${WEATHER_STATION_ID}`],
      ["delete", `/v1/olympus/weather/station/${WEATHER_STATION_ID}`],
    ] as const)("%s %s answers 401", async (method, path) => {
      const res = await t.http()[method](path);
      expect(res.status).toBe(401);
    });
  });

  describe("as a user who is not an admin", () => {
    it("lists and describes stations", async () => {
      t.graphql.on("ListWeatherStations", {
        olympus_weather_stations: [graphQlWeatherStation()],
      });
      t.graphql.on("DescribeWeatherStation", {
        olympus_weather_stations_by_pk: graphQlWeatherStation(),
      });

      const list = await t
        .http()
        .get("/v1/olympus/weather/stations")
        .set("authorization", `Bearer ${userToken}`);
      const one = await t
        .http()
        .get(`/v1/olympus/weather/station/${WEATHER_STATION_ID}`)
        .set("authorization", `Bearer ${userToken}`);

      expect(list.status).toBe(200);
      expect(list.body.weatherStations).toEqual([
        expect.objectContaining({
          id: WEATHER_STATION_ID,
          name: "Mill Creek",
          macAddress: WEATHER_STATION_MAC,
        }),
      ]);
      expect(one.status).toBe(200);
      expect(one.body.weatherStation.name).toBe("Mill Creek");
    });

    it.each([
      ["post", "/v1/olympus/weather/stations"],
      ["put", `/v1/olympus/weather/station/${WEATHER_STATION_ID}`],
      ["delete", `/v1/olympus/weather/station/${WEATHER_STATION_ID}`],
    ] as const)("%s %s answers 403", async (method, path) => {
      const res = await t
        .http()
        [method](path)
        .set("authorization", `Bearer ${userToken}`)
        .send({
          weatherStation: { name: "x", macAddress: WEATHER_STATION_MAC },
        });
      expect(res.status).toBe(403);
    });
  });

  describe("as an admin", () => {
    const as = (request: { set: (k: string, v: string) => unknown }) =>
      request.set("authorization", `Bearer ${adminToken}`);

    it("registers a station, with its Location", async () => {
      t.graphql.on("CreateWeatherStation", {
        insert_olympus_weather_stations_one: graphQlWeatherStation(),
      });

      const res = await as(
        t
          .http()
          .post("/v1/olympus/weather/stations")
          .send({
            weatherStation: { name: "Mill Creek", macAddress: "a0b1c2d3e4f5" },
          }),
      );

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(
        `/v1/olympus/weather/station/${WEATHER_STATION_ID}`,
      );
      expect(t.graphql.calls("CreateWeatherStation")[0].variables).toEqual({
        object: { name: "Mill Creek", macAddress: WEATHER_STATION_MAC },
      });
    });

    it("answers 400 for a MAC that is not one", async () => {
      const res = await as(
        t
          .http()
          .post("/v1/olympus/weather/stations")
          .send({ weatherStation: { name: "Mill Creek", macAddress: "nope" } }),
      );
      expect(res.status).toBe(400);
    });

    it("renames a station", async () => {
      t.graphql.on("UpdateWeatherStation", {
        update_olympus_weather_stations_by_pk: graphQlWeatherStation({
          name: "Back deck",
        }),
      });
      const res = await as(
        t
          .http()
          .put(`/v1/olympus/weather/station/${WEATHER_STATION_ID}`)
          .send({ weatherStation: { name: "Back deck" } }),
      );
      expect(res.status).toBe(200);
      expect(res.body.weatherStation.name).toBe("Back deck");
    });

    it("answers 304 to an update that changes nothing", async () => {
      const res = await as(
        t
          .http()
          .put(`/v1/olympus/weather/station/${WEATHER_STATION_ID}`)
          .send({ weatherStation: {} }),
      );
      expect(res.status).toBe(304);
    });

    it("removes a station", async () => {
      t.graphql.on("DeleteWeatherStation", {
        delete_olympus_weather_stations_by_pk: { id: WEATHER_STATION_ID },
      });
      const res = await as(
        t.http().delete(`/v1/olympus/weather/station/${WEATHER_STATION_ID}`),
      );
      expect(res.status).toBe(204);
    });

    it("answers 404 for a station that is not there", async () => {
      t.graphql.on("DeleteWeatherStation", {
        delete_olympus_weather_stations_by_pk: null,
      });
      const res = await as(
        t.http().delete(`/v1/olympus/weather/station/${WEATHER_STATION_ID}`),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("ReplayWeatherArchive", () => {
    const replay = (token: string, body: unknown) =>
      t
        .http()
        .post("/v1/olympus/weather/archive/replay")
        .set("authorization", `Bearer ${token}`)
        .send(body);

    const settled = async () => {
      const replays = t.app.get(WeatherReplayService);
      for (let i = 0; i < 100 && replays.running; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(replays.running).toBe(false);
    };

    it("replays a day of this API's archive in the background", async () => {
      const month = join(archive, "A0-B1-C2-D3-E4-F5", "2026", "08");
      mkdirSync(month, { recursive: true });
      writeFileSync(
        join(month, "01.jsonl"),
        JSON.stringify({
          receivedAt: "2026-08-01T12:00:03.000Z",
          source: "push",
          remote: "192.168.15.20",
          query: ambientPush({ dateutc: "2026-08-01+12:00:00" }),
        }) + "\n",
      );
      t.graphql.on("GetWeatherStationByMac", {
        olympus_weather_stations: [graphQlWeatherStation()],
      });
      t.graphql.on("CreateWeatherStationSamples", {
        insert_olympus_weather_station_samples: { affected_rows: 1 },
      });
      t.graphql.on("ListWeatherRollupTiers", {
        olympus_weather_rollup_tiers: [
          {
            name: "5m",
            bucket: "00:05:00",
            sourceTier: "1m",
            builtUntil: null,
          },
          {
            name: "1m",
            bucket: "00:01:00",
            sourceTier: null,
            builtUntil: null,
          },
        ],
      });
      t.graphql.on("RollupWeatherSamples", {
        olympus_weather_rollup_samples: [
          { tier: "1m", rowsWritten: 16, rowsPruned: 0 },
        ],
      });
      t.graphql.on("RollupWeatherTier", {
        olympus_weather_rollup_tier: [
          { tier: "5m", rowsWritten: 16, rowsPruned: 0 },
        ],
      });
      t.graphql.on("PruneWeatherRollups", {
        olympus_weather_prune: [
          { tier: "samples", rowsWritten: 0, rowsPruned: 0 },
        ],
      });

      const res = await replay(adminToken, {
        replay: { from: "2026-08-01", to: "2026-08-01" },
      });

      expect(res.status).toBe(202);
      await settled();
      const [object] = (
        t.graphql.calls("CreateWeatherStationSamples")[0].variables as {
          objects: Record<string, unknown>[];
        }
      ).objects;
      expect(object.observedTime).toBe("2026-08-01T12:00:00.000Z");
      expect(t.graphql.calls("RollupWeatherSamples")[0].variables).toEqual({
        fromTime: "2026-08-01T00:00:00.000Z",
        toTime: "2026-08-02T00:00:00.000Z",
      });
      expect(t.graphql.calls("RollupWeatherTier")[0].variables).toMatchObject({
        tier: "5m",
      });
      expect(t.graphql.calls("PruneWeatherRollups")).toHaveLength(1);
    });

    it("answers 400 to a range that is not one", async () => {
      const res = await replay(adminToken, {
        replay: { from: "2026-08-02", to: "2026-08-01" },
      });
      expect(res.status).toBe(400);
    });

    it("is an admin's", async () => {
      const res = await replay(userToken, {
        replay: { from: "2026-08-01", to: "2026-08-01" },
      });
      expect(res.status).toBe(403);
    });

    it("answers 401 without a token", async () => {
      const res = await t
        .http()
        .post("/v1/olympus/weather/archive/replay")
        .send({ replay: { from: "2026-08-01", to: "2026-08-01" } });
      expect(res.status).toBe(401);
    });

    it("answers 409 while a replay is running", async () => {
      let release: () => void = () => undefined;
      t.graphql.on(
        "ListWeatherRollupTiers",
        () =>
          new Promise((resolve) => {
            release = () => resolve({ olympus_weather_rollup_tiers: [] });
          }),
      );
      const body = { replay: { from: "2026-07-01", to: "2026-07-01" } };
      expect((await replay(adminToken, body)).status).toBe(202);
      expect((await replay(adminToken, body)).status).toBe(409);
      release();
      await settled();
    });
  });
});
