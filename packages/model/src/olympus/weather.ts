import { ApiProperty, PartialType, PickType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * The kind of weather, from most to least significant. The provider's own
 * condition is kept beside it as text; the kind is what the site draws.
 */
export enum WeatherConditionKind {
  Thunderstorm = "thunderstorm",
  Snow = "snow",
  Rain = "rain",
  Drizzle = "drizzle",
  Fog = "fog",
  Cloudy = "cloudy",
  PartlyCloudy = "partly_cloudy",
  Clear = "clear",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A place a user keeps a forecast for (ADR 0024). */
export class WeatherLocation {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the location",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The name the user gave the location, shown in the widget",
  })
  label: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The Google place ID the location was chosen from, if any",
  })
  placeId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "Google's formatted name for the place, shown under the label when managing locations",
  })
  placeName?: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The latitude of the location in degrees, -90 to 90",
  })
  latitude: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The longitude of the location in degrees, -180 to 180",
  })
  longitude: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Where the location sits in the user's list; lower comes first",
  })
  position: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the widget opens on this location. At most one of a user's locations is the default",
  })
  isDefault: boolean;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the location was added",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the location was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** Conditions at a location now (ADR 0024: OpenWeather's current weather). */
export class CurrentWeather {
  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the conditions were observed",
  })
  observedTime: Moment;

  @ApiProperty({
    enum: () => WeatherConditionKind,
    enumName: "WeatherConditionKind",
    enumSchema: { description: "The kind of weather, for choosing an icon" },
    required: true,
    description: "The kind of weather now",
  })
  conditionKind: WeatherConditionKind;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The provider's description of the weather now, e.g. light rain",
  })
  condition: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether it is daytime at the location",
  })
  isDaytime: boolean;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The temperature in degrees Fahrenheit",
  })
  temperatureF: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "What the temperature feels like, in degrees Fahrenheit",
  })
  feelsLikeF: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Today's expected high in degrees Fahrenheit, from now and the rest of today's forecast",
  })
  highF: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Today's expected low in degrees Fahrenheit, from now and the rest of today's forecast",
  })
  lowF: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Relative humidity as a percentage",
  })
  humidityPct: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The dew point in degrees Fahrenheit, calculated from temperature and humidity",
  })
  dewPointF: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Sea-level pressure in hectopascals",
  })
  pressureHpa: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Sea-level pressure in inches of mercury",
  })
  pressureInHg: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The wind speed in miles per hour",
  })
  windSpeedMph: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The wind gust speed in miles per hour, when reported",
  })
  windGustMph?: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The direction the wind blows from, in degrees clockwise from north",
  })
  windDirectionDeg: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The visibility in miles, when reported; the provider reports at most about 6.2",
  })
  visibilityMi?: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Cloud cover as a percentage",
  })
  cloudCoverPct: number;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string indicating today's sunrise",
  })
  sunriseTime: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string indicating today's sunset",
  })
  sunsetTime: Moment;
}

/** One 3-hour step of the forecast. */
export class ForecastStep {
  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string indicating when the step starts",
  })
  time: Moment;

  @ApiProperty({
    enum: () => WeatherConditionKind,
    enumName: "WeatherConditionKind",
    enumSchema: { description: "The kind of weather, for choosing an icon" },
    required: true,
    description: "The kind of weather expected in the step",
  })
  conditionKind: WeatherConditionKind;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The provider's description of the weather expected in the step",
  })
  condition: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the step is in daytime at the location",
  })
  isDaytime: boolean;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The expected temperature in degrees Fahrenheit",
  })
  temperatureF: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The chance of precipitation in the step, as a percentage",
  })
  precipitationChancePct: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The expected rain and snow (as water) in the step, in inches",
  })
  precipitationIn: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The expected wind speed in miles per hour",
  })
  windSpeedMph: number;
}

/** One local day of the forecast, summarized from its steps. */
export class ForecastDay {
  @ApiProperty({
    type: String,
    required: true,
    description: "The local date, YYYY-MM-DD",
  })
  date: string;

  @ApiProperty({
    enum: () => WeatherConditionKind,
    enumName: "WeatherConditionKind",
    enumSchema: { description: "The kind of weather, for choosing an icon" },
    required: true,
    description: "The most significant kind of weather expected that day",
  })
  conditionKind: WeatherConditionKind;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The provider's description of the day's most significant weather",
  })
  condition: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The day's expected high in degrees Fahrenheit",
  })
  highF: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The day's expected low in degrees Fahrenheit",
  })
  lowF: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The highest chance of precipitation in any of the day's steps, as a percentage",
  })
  precipitationChancePct: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The expected rain and snow (as water) over the day's steps, in inches",
  })
  precipitationIn: number;
}

/**
 * A location's forecast: now, the next 24 hours in 3-hour steps and five
 * local days, from OpenWeather's free plan (ADR 0024).
 */
export class WeatherForecast {
  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the location the forecast is for",
  })
  locationId: string;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The location's offset from UTC in seconds, which decides where its days begin",
  })
  utcOffsetSeconds: number;

  @ApiProperty({
    type: () => CurrentWeather,
    required: true,
    description: "The conditions now",
  })
  current: CurrentWeather;

  @ApiProperty({
    type: () => ForecastStep,
    isArray: true,
    required: true,
    description: "The next eight 3-hour steps",
  })
  next: ForecastStep[];

  @ApiProperty({
    type: () => ForecastDay,
    isArray: true,
    required: true,
    description: "Today and the four days after it, in local days",
  })
  days: ForecastDay[];

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the forecast was fetched from the provider",
  })
  fetchedTime: Moment;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the provider is failing and this is the last forecast fetched while it worked",
  })
  stale: boolean;
}

/** What a user supplies to add a location. */
export class BaseWeatherLocation extends PickType(WeatherLocation, [
  "label",
  "placeId",
  "placeName",
  "latitude",
  "longitude",
] as const) {}

/**
 * What a user may change about a location: its label, and whether it is the
 * default. A different place is a different location.
 */
export class PartialWeatherLocation extends PartialType(
  PickType(WeatherLocation, ["label", "isDefault"] as const),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateWeatherLocationRequest {
  @ApiProperty({
    type: () => BaseWeatherLocation,
    required: true,
    description: "The location to add at the end of the caller's list.",
  })
  weatherLocation: BaseWeatherLocation;
}

export class UpdateWeatherLocationRequest {
  @ApiProperty({
    type: () => PartialWeatherLocation,
    required: true,
    description: "The changes to make to the location.",
  })
  weatherLocation: PartialWeatherLocation;
}

export class ReorderWeatherLocationsRequest {
  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "Every one of the caller's location IDs, in the order they should appear.",
  })
  locationIds: string[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListWeatherLocationsResponse {
  @ApiProperty({
    type: () => WeatherLocation,
    isArray: true,
    required: true,
    description: "The caller's locations, in their order.",
  })
  weatherLocations: WeatherLocation[];
}

export class DescribeWeatherLocationResponse {
  @ApiProperty({
    type: () => WeatherLocation,
    required: true,
    description: "The location.",
  })
  weatherLocation: WeatherLocation;
}

export class CreateWeatherLocationResponse {
  @ApiProperty({
    type: () => WeatherLocation,
    required: true,
    description: "The location as added.",
  })
  weatherLocation: WeatherLocation;
}

export class UpdateWeatherLocationResponse {
  @ApiProperty({
    type: () => WeatherLocation,
    required: true,
    description: "The location with the changes applied.",
  })
  weatherLocation: WeatherLocation;
}

export class ReorderWeatherLocationsResponse {
  @ApiProperty({
    type: () => WeatherLocation,
    isArray: true,
    required: true,
    description: "The caller's locations in their new order.",
  })
  weatherLocations: WeatherLocation[];
}

export class DescribeWeatherForecastResponse {
  @ApiProperty({
    type: () => WeatherForecast,
    required: true,
    description: "The location's forecast.",
  })
  weatherForecast: WeatherForecast;
}
