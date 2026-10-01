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

/** The forecast map layers OpenWeather's free plan draws (ADR 0024). */
export enum WeatherMapLayer {
  Temperature = "temperature",
  Precipitation = "precipitation",
  Clouds = "clouds",
  Wind = "wind",
  Pressure = "pressure",
}

/**
 * How a replay treats a reading already stored (ADR 0025): `ignore` keeps
 * it, `replace` overwrites it (after a parser fix).
 */
export enum WeatherArchiveReplayMode {
  Ignore = "ignore",
  Replace = "replace",
}

/** Where an archive line came from: a console's push, or a backfill response. */
export enum WeatherArchiveRecordSource {
  Push = "push",
  Backfill = "backfill",
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
    description:
      "What the expected temperature feels like, in degrees Fahrenheit, accounting for humidity and wind",
  })
  feelsLikeF: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The expected relative humidity as a percentage",
  })
  humidityPct: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The expected sea-level pressure in hectopascals",
  })
  pressureHpa: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The expected sea-level pressure in inches of mercury",
  })
  pressureInHg: number;

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

/** One frame of past radar (RainViewer), ten minutes apart. */
export class RadarFrame {
  @ApiProperty({
    type: String,
    required: true,
    description: "The frame's ID, used to ask for its tiles",
  })
  id: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the radar was captured",
  })
  time: Moment;
}

/**
 * One reading of a station: a push, or a record backfilled from
 * ambientweather.net. Every value is optional: a console reports what its
 * sensors have.
 */
export class WeatherStationReading {
  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the console took the reading",
  })
  observedTime: Moment;

  @ApiProperty({
    enum: () => WeatherArchiveRecordSource,
    enumName: "WeatherArchiveRecordSource",
    enumSchema: {
      description:
        "Where an archive line came from: a console's push, or a backfill response",
    },
    required: true,
    description: "Whether the reading was pushed or backfilled",
  })
  source: WeatherArchiveRecordSource;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Outdoor temperature, °F",
  })
  outdoorTemperatureF?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Outdoor relative humidity, %",
  })
  outdoorHumidityPct?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Indoor temperature, °F",
  })
  indoorTemperatureF?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Indoor relative humidity, %",
  })
  indoorHumidityPct?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Dew point, °F",
  })
  dewPointF?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Feels-like temperature, °F",
  })
  feelsLikeF?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Wind speed, mph",
  })
  windSpeedMph?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Wind speed averaged over 10 minutes, mph",
  })
  windSpeedAvg10mMph?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Wind gust, mph",
  })
  windGustMph?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The day's highest gust so far, mph",
  })
  maxDailyGustMph?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Wind direction, degrees from north",
  })
  windDirectionDeg?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Wind direction averaged over 10 minutes, degrees from north",
  })
  windDirectionAvg10mDeg?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Rain rate, inches an hour",
  })
  rainRateInHr?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Rain in the current event, inches",
  })
  rainEventIn?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Rain since the console's midnight, inches",
  })
  rainDailyIn?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Rain this week, inches",
  })
  rainWeeklyIn?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Rain this month, inches",
  })
  rainMonthlyIn?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Rain this year, inches",
  })
  rainYearlyIn?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Barometric pressure adjusted to sea level, inHg",
  })
  pressureRelativeInhg?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Barometric pressure at the station, inHg",
  })
  pressureAbsoluteInhg?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "UV index",
  })
  uvIndex?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Solar radiation, W/m²",
  })
  solarRadiationWm2?: number;

  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Whether the outdoor sensor's battery is OK",
  })
  batteryOutdoorOk?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Whether the console's battery is OK",
  })
  batteryIndoorOk?: boolean;
}

/** One bucket of a series: the tier's statistics for it. */
export class WeatherSeriesPoint {
  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the bucket starts",
  })
  time: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of samples in the bucket",
  })
  count: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The average over the bucket; for wind direction, the direction of the average wind",
  })
  mean: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The lowest sample in the bucket",
  })
  min?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The highest sample in the bucket",
  })
  max?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The samples added up: the total, for rain",
  })
  sum?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The bucket's first sample",
  })
  first?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The bucket's last sample",
  })
  last?: number;
}

/** One metric of a station over a range, at one tier's resolution. */
export class WeatherStationSeries {
  @ApiProperty({
    type: String,
    required: true,
    description: "The metric, e.g. outdoor_temperature, or wind_direction",
  })
  metric: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The metric's unit, e.g. F, mph, in, deg",
  })
  unit: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "How the metric is read: mean, sum, max, or vector for wind direction",
  })
  rollup: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The tier the points come from: 1m, 5m, 15m, 30m or 1h",
  })
  resolution: string;

  @ApiProperty({
    type: () => WeatherSeriesPoint,
    isArray: true,
    required: true,
    description: "The buckets that have samples, oldest first",
  })
  points: WeatherSeriesPoint[];
}

/** One of the house's weather stations, known by its console's MAC address. */
export class WeatherStation {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the station",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The station's name, as the widget shows it",
  })
  name: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The console's MAC address, which it sends as its PASSKEY, e.g. A0:B1:C2:D3:E4:F5",
  })
  macAddress: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the station was registered",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the station was last changed",
  })
  lastUpdatedTime?: Moment;
  @ApiProperty({
    type: () => WeatherStationReading,
    required: false,
    description:
      "The station's newest reading, when there is one within the samples' retention",
  })
  latestReading?: WeatherStationReading;

  @ApiProperty({
    type: Boolean,
    required: false,
    description:
      "Whether the newest reading is recent (WEATHER_STATION_STALE_SECONDS)",
  })
  reporting?: boolean;
}

/** What registering a station takes. */
export class BaseWeatherStation extends PickType(WeatherStation, [
  "name",
  "macAddress",
] as const) {}

/** What may change about a station: its name. A new console is a new station. */
export class PartialWeatherStation extends PartialType(
  PickType(WeatherStation, ["name"] as const),
) {}

/** A range of the raw station archive to load again (plan phase 6). */
export class WeatherArchiveReplay {
  @ApiProperty({
    type: String,
    required: true,
    description: "The first UTC day to replay, YYYY-MM-DD",
  })
  from: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The last UTC day to replay, YYYY-MM-DD, inclusive",
  })
  to: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "Only this station's archive, by its console's MAC address; every station when absent",
  })
  macAddress?: string;

  @ApiProperty({
    enum: () => WeatherArchiveReplayMode,
    enumName: "WeatherArchiveReplayMode",
    enumSchema: {
      description: "How a replay treats a reading already stored",
    },
    required: false,
    description:
      "ignore (the default) keeps stored readings; replace overwrites them",
  })
  mode?: WeatherArchiveReplayMode;
}

/**
 * One line of a raw station archive with the station it belongs to, as the
 * dev relay forwards it (ADR 0025). Raw on purpose: the receiving API
 * parses it with its own code.
 */
export class WeatherArchiveRecord {
  @ApiProperty({
    type: String,
    required: true,
    description: "The console's MAC address, e.g. A0:B1:C2:D3:E4:F5",
  })
  macAddress: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the archiving API received the line",
  })
  receivedAt: string;

  @ApiProperty({
    enum: () => WeatherArchiveRecordSource,
    enumName: "WeatherArchiveRecordSource",
    enumSchema: {
      description:
        "Where an archive line came from: a console's push, or a backfill response",
    },
    required: true,
    description: "Where the line came from",
  })
  source: WeatherArchiveRecordSource;

  @ApiProperty({
    type: String,
    required: false,
    description: "The address a push came from, as the archiving API saw it",
  })
  remote?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "A push's query string, exactly as received",
  })
  query?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "A backfill line's ambientweather.net response, as the JSON text it was received as",
  })
  responseJson?: string;
}

/** A range of a station's history to fetch from ambientweather.net (plan phase 7). */
export class WeatherStationBackfill {
  @ApiProperty({
    type: String,
    required: true,
    description: "The first UTC day to fetch, YYYY-MM-DD",
  })
  from: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The last UTC day to fetch, YYYY-MM-DD, inclusive",
  })
  to: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Only this station, by its ID; every station when absent",
  })
  stationId?: string;
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

export class CreateWeatherStationRequest {
  @ApiProperty({
    type: () => BaseWeatherStation,
    required: true,
    description: "The station to register.",
  })
  weatherStation: BaseWeatherStation;
}

export class UpdateWeatherStationRequest {
  @ApiProperty({
    type: () => PartialWeatherStation,
    required: true,
    description: "The changes to make to the station.",
  })
  weatherStation: PartialWeatherStation;
}

export class ReplayWeatherArchiveRequest {
  @ApiProperty({
    type: () => WeatherArchiveReplay,
    required: true,
    description: "The days to replay, and how.",
  })
  replay: WeatherArchiveReplay;
}

export class BackfillWeatherStationsRequest {
  @ApiProperty({
    type: () => WeatherStationBackfill,
    required: true,
    description: "The days to fetch, and for which station.",
  })
  backfill: WeatherStationBackfill;
}

export class ImportWeatherStationReadingsRequest {
  @ApiProperty({
    type: () => WeatherArchiveRecord,
    isArray: true,
    required: true,
    description: "Up to 500 archive lines, stored with this API's parser.",
  })
  records: WeatherArchiveRecord[];
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

export class ListRadarFramesResponse {
  @ApiProperty({
    type: () => RadarFrame,
    isArray: true,
    required: true,
    description: "The past radar frames available, oldest first.",
  })
  radarFrames: RadarFrame[];
}

export class ListWeatherStationsResponse {
  @ApiProperty({
    type: () => WeatherStation,
    isArray: true,
    required: true,
    description: "The registered stations, by name.",
  })
  weatherStations: WeatherStation[];
}

export class DescribeWeatherStationResponse {
  @ApiProperty({
    type: () => WeatherStation,
    required: true,
    description: "The station.",
  })
  weatherStation: WeatherStation;
}

export class CreateWeatherStationResponse {
  @ApiProperty({
    type: () => WeatherStation,
    required: true,
    description: "The station as registered.",
  })
  weatherStation: WeatherStation;
}

export class UpdateWeatherStationResponse {
  @ApiProperty({
    type: () => WeatherStation,
    required: true,
    description: "The station with the changes applied.",
  })
  weatherStation: WeatherStation;
}

export class ListWeatherStationSeriesResponse {
  @ApiProperty({
    type: () => WeatherStationSeries,
    isArray: true,
    required: true,
    description: "One series per metric asked for, in the order asked",
  })
  weatherStationSeries: WeatherStationSeries[];
}

export class ImportWeatherStationReadingsResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Readings stored",
  })
  stored: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Readings this environment already had",
  })
  duplicate: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Lines from a station this environment has not registered",
  })
  unknownStation: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Lines this environment's parser could not read",
  })
  invalid: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Lines kept for later, such as backfill responses",
  })
  skipped: number;
}
