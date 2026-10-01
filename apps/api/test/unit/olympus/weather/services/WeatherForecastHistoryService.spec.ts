import moment from "moment";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WeatherForecastHistoryService } from "../../../../../src/olympus/weather/services/WeatherForecastHistoryService";
import {
  FIRST_STEP,
  LIGHT_RAIN,
  openWeatherForecast,
  openWeatherSnapshot,
  step,
} from "../../../../fixtures/openWeather";

const PLACE = { latitude: 47.85, longitude: -122.24 };
const name = (document: unknown) =>
  String(document).match(/(?:query|mutation) (\w+)/)?.[1];

describe("WeatherForecastHistoryService", () => {
  let request: ReturnType<typeof vi.fn>;
  let service: WeatherForecastHistoryService;

  beforeEach(() => {
    request = vi.fn().mockResolvedValue({
      olympus_weather_forecast_steps: [],
      olympus_weather_observed_temperatures: [],
    });
    service = new WeatherForecastHistoryService({ request } as never);
  });

  it("keeps every step of a fetch and its current temperature", async () => {
    const forecast = openWeatherForecast();
    forecast.list[0] = step(FIRST_STEP, 55, LIGHT_RAIN, {
      pop: 0.72,
      rain: { "3h": 2.5 },
      snow: { "3h": 0.5 },
    });
    await service.record(
      PLACE,
      openWeatherSnapshot({ forecast }),
      moment.utc("2026-09-29T20:00:00Z"),
    );

    const [document, variables] = request.mock.calls[0];
    expect(name(document)).toBe("SaveWeatherForecastHistory");
    // A later fetch's step replaces an earlier one's: an explicit list.
    expect(String(document)).toMatch(/update_columns: \[\s*temperatureF/);
    expect(variables.steps).toHaveLength(40);
    expect(variables.steps[0]).toEqual({
      latitude: 47.85,
      longitude: -122.24,
      stepTime: "2026-09-29T21:00:00.000Z",
      temperatureF: 55,
      precipitationChance: 0.72,
      precipitationMm: 3,
      conditionId: LIGHT_RAIN.id,
      conditionMain: LIGHT_RAIN.main,
      conditionDescription: LIGHT_RAIN.description,
      conditionIcon: LIGHT_RAIN.icon,
      fetchedTime: "2026-09-29T20:00:00.000Z",
    });
    expect(variables.observed).toEqual({
      latitude: 47.85,
      longitude: -122.24,
      observedTime: "2026-09-29T19:50:00.000Z",
      temperatureF: 58.1,
    });
  });

  it("reads a place's steps back as forecast entries", async () => {
    request.mockResolvedValue({
      olympus_weather_forecast_steps: [
        {
          stepTime: "2026-09-29T12:00:00+00:00",
          temperatureF: 41.3,
          precipitationChance: 0.9,
          precipitationMm: 2.54,
          conditionId: LIGHT_RAIN.id,
          conditionMain: LIGHT_RAIN.main,
          conditionDescription: LIGHT_RAIN.description,
          conditionIcon: LIGHT_RAIN.icon,
        },
      ],
      olympus_weather_observed_temperatures: [
        { observedTime: "2026-09-29T15:00:00+00:00", temperatureF: 44 },
      ],
    });
    const history = await service.since(
      PLACE,
      moment.utc("2026-09-29T07:00:00Z"),
    );

    const [document, variables] = request.mock.calls[0];
    expect(name(document)).toBe("ListWeatherForecastHistory");
    expect(variables).toEqual({
      latitude: 47.85,
      longitude: -122.24,
      from: "2026-09-29T07:00:00.000Z",
    });
    expect(history.temperaturesF).toEqual([44]);
    expect(history.steps).toEqual([
      expect.objectContaining({
        dt: moment.utc("2026-09-29T12:00:00Z").unix(),
        main: expect.objectContaining({ temp: 41.3 }),
        weather: [LIGHT_RAIN],
        pop: 0.9,
        rain: { "3h": 2.54 },
      }),
    ]);
  });

  it("deletes every place's rows from before a time", async () => {
    await service.prune(moment.utc("2026-09-27T20:00:00Z"));
    const [document, variables] = request.mock.calls[0];
    expect(name(document)).toBe("PruneWeatherForecastHistory");
    expect(variables).toEqual({ before: "2026-09-27T20:00:00.000Z" });
  });
});
