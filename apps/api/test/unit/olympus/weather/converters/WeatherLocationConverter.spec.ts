import { describe, expect, it } from "vitest";
import { graphQlWeatherLocation } from "../../../../fixtures/olympus";
import { toDomainObject } from "../../../../../src/olympus/weather/converters/WeatherLocationConverter";

describe("WeatherLocationConverter", () => {
  it("maps a row and parses its times", () => {
    const location = toDomainObject(graphQlWeatherLocation());
    expect(location).toMatchObject({
      label: "Washington",
      placeId: "ChIJplace-mill-creek",
      placeName: "Mill Creek, WA, USA",
      latitude: 47.8525684,
      longitude: -122.238287,
      position: 0,
      isDefault: true,
    });
    expect(location.createdTime.toISOString()).toBe("2026-09-29T12:00:00.000Z");
    expect(location.lastUpdatedTime?.toISOString()).toBe(
      "2026-09-29T12:30:00.000Z",
    );
  });

  it("maps nulls to undefined", () => {
    const location = toDomainObject(
      graphQlWeatherLocation({
        placeId: null,
        placeName: null,
        lastUpdatedTime: null,
      }),
    );
    expect(location.placeId).toBeUndefined();
    expect(location.placeName).toBeUndefined();
    expect(location.lastUpdatedTime).toBeUndefined();
  });
});
