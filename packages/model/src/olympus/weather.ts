import { ApiProperty, PartialType, PickType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../decorators";

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
