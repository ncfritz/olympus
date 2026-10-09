import { describe, expect, it } from "vitest";
import {
  dewPointF,
  feelsLikeF,
} from "../../../../../src/olympus/weather/utils/meteorology";

describe("meteorology", () => {
  it("derives a dew point that matches a psychrometric table", () => {
    // 70 °F at 50% relative humidity has a dew point of about 50.5 °F.
    expect(dewPointF(70, 50)).toBeCloseTo(50.5, 0);
    // Saturated air: the dew point is the temperature.
    expect(dewPointF(40, 100)).toBeCloseTo(40, 5);
  });

  it("uses the wind chill when it is cold and windy", () => {
    // NWS wind chill chart: 30 °F with a 15 mph wind feels like 19 °F.
    expect(feelsLikeF(30, 60, 15)).toBeCloseTo(19, 0);
  });

  it("uses the heat index when it is hot", () => {
    // NWS heat index chart: 90 °F at 60% humidity feels like 100 °F.
    expect(feelsLikeF(90, 60, 5)).toBeCloseTo(100, 0);
  });

  it("is the temperature in between, or when the wind is light", () => {
    expect(feelsLikeF(65, 80, 20)).toBe(65);
    expect(feelsLikeF(40, 80, 2)).toBe(40);
  });
});
