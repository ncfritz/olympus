import { WeatherConditionKind } from "@ncfritz/olympus-model";
import moment from "moment";
import { describe, expect, it } from "vitest";
import {
  daysCondition,
  kindOf,
  toDomainObject,
} from "../../../../../src/olympus/weather/converters/WeatherForecastConverter";
import {
  CLEAR,
  CLEAR_NIGHT,
  FIRST_STEP,
  LIGHT_RAIN,
  MODERATE_RAIN,
  OVERCAST,
  THUNDER,
  openWeatherCurrent,
  openWeatherForecast,
  openWeatherSnapshot,
  step,
} from "../../../../fixtures/openWeather";

const H = 3600;
const context = (now: number) => ({
  locationId: "loc-1",
  fetchedAt: moment.unix(FIRST_STEP - H),
  stale: false,
  now: moment.unix(now),
});

describe("WeatherForecastConverter", () => {
  describe("current conditions", () => {
    const { current } = toDomainObject(
      openWeatherSnapshot(),
      context(FIRST_STEP - H),
    );

    it("keeps the provider's reading, rounded", () => {
      expect(current).toMatchObject({
        conditionKind: WeatherConditionKind.Rain,
        condition: "light rain",
        isDaytime: true,
        temperatureF: 58.1,
        feelsLikeF: 55.4,
        humidityPct: 87,
        windSpeedMph: 9.2,
        windGustMph: 16.1,
        windDirectionDeg: 202,
        cloudCoverPct: 90,
      });
      expect(current.observedTime.toISOString()).toBe(
        "2026-09-29T19:50:00.000Z",
      );
      expect(current.sunriseTime.toISOString()).toBe(
        "2026-09-29T14:04:00.000Z",
      );
    });

    it("converts pressure, visibility and derives the dew point", () => {
      expect(current.pressureHpa).toBe(1014);
      expect(current.pressureInHg).toBe(29.94);
      expect(current.visibilityMi).toBe(6);
      expect(current.dewPointF).toBe(54.2);
    });

    it("takes today's high and low from the rest of today and now", () => {
      // Today's steps are 54, 58.2, 60 and 58.2; now is 58.1.
      expect(current.highF).toBe(60);
      expect(current.lowF).toBe(54);
    });

    it("leaves out a gust or visibility the provider did not report", () => {
      const { current: bare } = toDomainObject(
        openWeatherSnapshot({
          current: openWeatherCurrent({
            wind: { speed: 3, deg: 90 },
            visibility: undefined,
          }),
        }),
        context(FIRST_STEP - H),
      );
      expect(bare.windGustMph).toBeUndefined();
      expect(bare.visibilityMi).toBeUndefined();
    });
  });

  describe("next 24 hours", () => {
    it("is the next eight steps", () => {
      const { next } = toDomainObject(
        openWeatherSnapshot(),
        context(FIRST_STEP - H),
      );
      expect(next).toHaveLength(8);
      expect(next[0].time.toISOString()).toBe("2026-09-29T21:00:00.000Z");
      expect(next[7].time.toISOString()).toBe("2026-09-30T18:00:00.000Z");
    });

    it("keeps a step that has started but not ended, and drops one that has ended", () => {
      const during = toDomainObject(
        openWeatherSnapshot(),
        context(FIRST_STEP + 2 * H),
      );
      expect(during.next[0].time.unix()).toBe(FIRST_STEP);

      const after = toDomainObject(
        openWeatherSnapshot(),
        context(FIRST_STEP + 3 * H + 60),
      );
      expect(after.next[0].time.unix()).toBe(FIRST_STEP + 3 * H);
    });

    it("gives the chance and amount of precipitation per step", () => {
      const forecast = openWeatherForecast();
      forecast.list[0] = step(FIRST_STEP, 55, LIGHT_RAIN, {
        pop: 0.72,
        rain: { "3h": 2.54 },
      });
      const { next } = toDomainObject(
        openWeatherSnapshot({ forecast }),
        context(FIRST_STEP - H),
      );
      expect(next[0]).toMatchObject({
        conditionKind: WeatherConditionKind.Rain,
        precipitationChancePct: 72,
        precipitationIn: 0.1,
      });
    });
  });

  describe("days", () => {
    it("groups steps into five local days, starting today", () => {
      const { days } = toDomainObject(
        openWeatherSnapshot(),
        context(FIRST_STEP - H),
      );
      expect(days.map((day) => day.date)).toEqual([
        "2026-09-29",
        "2026-09-30",
        "2026-10-01",
        "2026-10-02",
        "2026-10-03",
      ]);
    });

    it("starts a location's day at its own midnight", () => {
      // Bath in summer time: 21:00Z is 22:00 there, 00:00Z is tomorrow.
      const forecast = openWeatherForecast({
        city: { timezone: 3600, sunrise: 0, sunset: 0 },
      });
      const { days } = toDomainObject(
        openWeatherSnapshot({
          forecast,
          current: openWeatherCurrent({ timezone: 3600 }),
        }),
        context(FIRST_STEP + 90 * 60),
      );
      expect(days[0].date).toBe("2026-09-29");
      // Only the 22:00 step and now are today, in Bath.
      expect(days[0].highF).toBe(58.1);
      expect(days[0].lowF).toBe(54);
      expect(days[1].date).toBe("2026-09-30");
    });

    it("builds today from now alone when none of its steps is left", () => {
      // 23:30 local; the first step is 02:00 tomorrow.
      const lateNow = FIRST_STEP + 9 * H + 30 * 60;
      const forecast = openWeatherForecast({}, FIRST_STEP + 12 * H);
      const { days, current } = toDomainObject(
        openWeatherSnapshot({
          forecast,
          current: openWeatherCurrent({ weather: [CLEAR_NIGHT] }),
        }),
        context(lateNow),
      );
      expect(days[0]).toMatchObject({
        date: "2026-09-29",
        highF: 58.1,
        lowF: 58.1,
        conditionKind: WeatherConditionKind.Clear,
        precipitationChancePct: 0,
      });
      expect(days).toHaveLength(5);
      expect(current.isDaytime).toBe(false);
    });

    it("totals the day's precipitation and keeps its highest chance", () => {
      const forecast = openWeatherForecast();
      forecast.list[0] = step(FIRST_STEP, 55, LIGHT_RAIN, {
        pop: 0.4,
        rain: { "3h": 1.27 },
      });
      forecast.list[1] = step(FIRST_STEP + 3 * H, 55, MODERATE_RAIN, {
        pop: 0.8,
        rain: { "3h": 3.81 },
      });
      const { days } = toDomainObject(
        openWeatherSnapshot({ forecast }),
        context(FIRST_STEP - H),
      );
      expect(days[0].precipitationChancePct).toBe(80);
      expect(days[0].precipitationIn).toBe(0.2);
      expect(days[0].conditionKind).toBe(WeatherConditionKind.Rain);
    });
  });

  describe("a day's condition", () => {
    const at = (i: number) => FIRST_STEP + i * 3 * H;

    it("is likely wet weather when there is any", () => {
      const chosen = daysCondition([
        step(at(0), 55, OVERCAST),
        step(at(1), 55, LIGHT_RAIN, { pop: 0.6 }),
        step(at(2), 55, OVERCAST),
      ]);
      expect(chosen.description).toBe("light rain");
    });

    it("ignores wet weather that is unlikely", () => {
      const chosen = daysCondition([
        step(at(0), 55, OVERCAST),
        step(at(1), 55, LIGHT_RAIN, { pop: 0.3 }),
        step(at(2), 55, OVERCAST),
      ]);
      expect(chosen.description).toBe("overcast clouds");
    });

    it("prefers the more significant of two likely wet kinds", () => {
      const chosen = daysCondition([
        step(at(0), 55, MODERATE_RAIN, { pop: 0.9 }),
        step(at(1), 55, THUNDER, { pop: 0.5 }),
      ]);
      expect(chosen.description).toBe("thunderstorm");
    });

    it("is otherwise what the daytime shows most", () => {
      const night = { ...OVERCAST, icon: "04n" };
      const chosen = daysCondition([
        step(at(0), 55, night),
        step(at(1), 55, night),
        step(at(2), 55, night),
        step(at(3), 55, night),
        step(at(4), 55, CLEAR),
        step(at(5), 55, CLEAR),
      ]);
      expect(chosen.description).toBe("clear sky");
    });

    it("breaks a tie toward the more significant kind", () => {
      const chosen = daysCondition([
        step(at(0), 55, CLEAR),
        step(at(1), 55, OVERCAST),
      ]);
      expect(chosen.description).toBe("overcast clouds");
    });
  });

  it("passes the fetch time and staleness through", () => {
    const forecast = toDomainObject(openWeatherSnapshot(), {
      ...context(FIRST_STEP),
      stale: true,
    });
    expect(forecast.stale).toBe(true);
    expect(forecast.locationId).toBe("loc-1");
    expect(forecast.utcOffsetSeconds).toBe(-25_200);
    expect(forecast.fetchedTime.toISOString()).toBe("2026-09-29T20:00:00.000Z");
  });

  it.each([
    [211, WeatherConditionKind.Thunderstorm],
    [301, WeatherConditionKind.Drizzle],
    [500, WeatherConditionKind.Rain],
    [511, WeatherConditionKind.Rain],
    [601, WeatherConditionKind.Snow],
    [741, WeatherConditionKind.Fog],
    [800, WeatherConditionKind.Clear],
    [801, WeatherConditionKind.PartlyCloudy],
    [802, WeatherConditionKind.PartlyCloudy],
    [803, WeatherConditionKind.Cloudy],
    [804, WeatherConditionKind.Cloudy],
  ])("maps condition %i to %s", (id, kind) => {
    expect(kindOf(id)).toBe(kind);
  });
});
