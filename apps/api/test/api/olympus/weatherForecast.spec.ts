import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as jose from "jose";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { issueAccessToken } from "../../../src/auth/tokens/accessTokens";
import { SigningKeyService } from "../../../src/auth/tokens/SigningKeyService";
import { OpenWeatherClient } from "../../../src/olympus/weather/providers/OpenWeatherClient";
import { ProviderError } from "../../../src/olympus/weather/providers/ProviderError";
import {
  graphQlWeatherLocation,
  WEATHER_LOCATION_ID,
} from "../../fixtures/olympus";
import { openWeatherSnapshot } from "../../fixtures/openWeather";
import { createTestApp, type TestApp } from "../../support/testApp";

const USER = "5f1a0c6e-0000-4000-8000-000000000001";
const PATH = `/v1/olympus/weather/location/${WEATHER_LOCATION_ID}/forecast`;

/** DescribeWeatherForecast over the real HTTP stack, OpenWeather faked. */
describe("Weather forecast API", () => {
  let t: TestApp;
  let token: string;
  const openWeather = { configured: true, snapshot: vi.fn() };

  beforeAll(async () => {
    const keys = mkdtempSync(join(tmpdir(), "auth-keys-"));
    const { privateKey } = await jose.generateKeyPair("ES256", {
      extractable: true,
    });
    writeFileSync(
      join(keys, "2026-01-01.pem"),
      await jose.exportPKCS8(privateKey),
    );
    t = await createTestApp({
      env: { AUTH_SIGNING_KEYS: keys },
      overrides: [{ provide: OpenWeatherClient, useValue: openWeather }],
    });
    token = await issueAccessToken(t.app.get(SigningKeyService).require(), {
      sub: USER,
      clientId: "olympus-site",
      sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
      roles: ["user"],
      authTime: 1_790_000_000,
    });
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(() => {
    t.reset();
    openWeather.configured = true;
    openWeather.snapshot.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T20:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  const get = () => t.http().get(PATH).set("authorization", `Bearer ${token}`);

  /** The forecast history, empty unless a test gives it rows. */
  const history = (steps: unknown[] = [], temperatures: unknown[] = []) => {
    t.graphql.on("ListWeatherForecastHistory", {
      olympus_weather_forecast_steps: steps,
      olympus_weather_observed_temperatures: temperatures,
    });
    t.graphql.on("SaveWeatherForecastHistory", {
      insert_olympus_weather_forecast_steps: { affected_rows: 40 },
      insert_olympus_weather_observed_temperatures: { affected_rows: 1 },
    });
    t.graphql.on("PruneWeatherForecastHistory", {
      delete_olympus_weather_forecast_steps: { affected_rows: 0 },
      delete_olympus_weather_observed_temperatures: { affected_rows: 0 },
    });
  };

  it("answers the caller's location's forecast", async () => {
    t.graphql.on("DescribeWeatherLocation", {
      olympus_weather_locations: [graphQlWeatherLocation()],
    });
    history();
    openWeather.snapshot.mockResolvedValue(openWeatherSnapshot());

    const res = await get();

    expect(res.status).toBe(200);
    const forecast = res.body.weatherForecast;
    expect(forecast.locationId).toBe(WEATHER_LOCATION_ID);
    expect(forecast.stale).toBe(false);
    expect(forecast.current).toMatchObject({
      conditionKind: "rain",
      temperatureF: 58.1,
      pressureInHg: 29.94,
    });
    expect(forecast.next).toHaveLength(8);
    expect(forecast.days).toHaveLength(5);
    expect(forecast.days[0].date).toBe("2026-09-29");
    expect(t.graphql.calls("DescribeWeatherLocation")[0].variables).toEqual({
      userId: USER,
      locationId: WEATHER_LOCATION_ID,
    });
    // The fetch is kept in the history for its place.
    const saved = t.graphql.calls("SaveWeatherForecastHistory")[0].variables!;
    expect(saved.steps).toHaveLength(40);
    expect(saved.observed).toMatchObject({
      latitude: 47.85,
      temperatureF: 58.1,
    });
  });

  it("builds today from the history, so the morning's low stays", async () => {
    t.graphql.on("DescribeWeatherLocation", {
      olympus_weather_locations: [graphQlWeatherLocation()],
    });
    history(
      [
        {
          stepTime: "2026-09-29T12:00:00+00:00",
          temperatureF: 41.3,
          precipitationChance: 0,
          precipitationMm: 0,
          conditionId: 800,
          conditionMain: "Clear",
          conditionDescription: "clear sky",
          conditionIcon: "01d",
        },
      ],
      [{ observedTime: "2026-09-29T16:00:00+00:00", temperatureF: 47 }],
    );
    openWeather.snapshot.mockResolvedValue(openWeatherSnapshot());

    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body.weatherForecast.days[0].lowF).toBe(41.3);
    expect(res.body.weatherForecast.current.lowF).toBe(41.3);
    expect(t.graphql.calls("ListWeatherForecastHistory")[0].variables).toEqual({
      latitude: 47.85,
      longitude: -122.24,
      from: "2026-09-29T07:00:00.000Z",
    });
  });

  it("answers 404 for someone else's location, and fetches nothing", async () => {
    t.graphql.on("DescribeWeatherLocation", { olympus_weather_locations: [] });
    const res = await get();
    expect(res.status).toBe(404);
    expect(openWeather.snapshot).not.toHaveBeenCalled();
  });

  it("answers 503 when the provider fails and there is nothing cached", async () => {
    t.graphql.on("DescribeWeatherLocation", {
      // A place no other test has fetched, so nothing is cached for it.
      olympus_weather_locations: [
        graphQlWeatherLocation({ latitude: -33.87, longitude: 151.21 }),
      ],
    });
    openWeather.snapshot.mockRejectedValue(
      new ProviderError("openweather", "timeout"),
    );
    const res = await get();
    expect(res.status).toBe(503);
  });

  it("answers 503 when forecasts are not configured", async () => {
    t.graphql.on("DescribeWeatherLocation", {
      olympus_weather_locations: [graphQlWeatherLocation()],
    });
    openWeather.configured = false;
    const res = await get();
    expect(res.status).toBe(503);
    expect(openWeather.snapshot).not.toHaveBeenCalled();
  });

  it("answers 401 without an identity", async () => {
    const res = await t.http().get(PATH);
    expect(res.status).toBe(401);
  });
});
