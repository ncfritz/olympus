import {
  BaseWeatherLocation,
  PartialWeatherLocation,
  WeatherLocation,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlWeatherLocation,
  toDomainObject,
} from "../converters/WeatherLocationConverter";
import { WEATHER_LOCATION } from "../queries/weatherLocations";

const MAX_LABEL = 100;
const MAX_PLACE_TEXT = 500;

/**
 * A user's weather locations in Hasura. Every method takes the caller's user
 * ID and scopes by it, so another user's location is simply not found.
 */
@Injectable()
export class WeatherLocationService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** The user's locations, in their order. */
  async list(userId: string): Promise<WeatherLocation[]> {
    const document = gql`
      query ListWeatherLocations($userId: uuid!) {
        olympus_weather_locations(
          where: { userId: { _eq: $userId } }
          order_by: { position: asc }
        ) {
          ${WEATHER_LOCATION}
        }
      }
    `;
    type Result = { olympus_weather_locations: GraphQlWeatherLocation[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
    });
    return result.olympus_weather_locations.map(toDomainObject);
  }

  /** One of the user's locations. */
  async describe(userId: string, locationId: string): Promise<WeatherLocation> {
    const document = gql`
      query DescribeWeatherLocation($userId: uuid!, $locationId: uuid!) {
        olympus_weather_locations(
          where: { id: { _eq: $locationId }, userId: { _eq: $userId } }
          limit: 1
        ) {
          ${WEATHER_LOCATION}
        }
      }
    `;
    type Result = { olympus_weather_locations: GraphQlWeatherLocation[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      locationId,
    });
    const row = result.olympus_weather_locations[0];
    if (!row) throw notFound(locationId);
    return toDomainObject(row);
  }

  /**
   * Adds a location at the end of the user's list. The first one a user adds
   * becomes their default.
   */
  async create(
    userId: string,
    location: BaseWeatherLocation | undefined,
  ): Promise<WeatherLocation> {
    const values = validateBase(location);

    const countDocument = gql`
      query GetWeatherLocationPositions($userId: uuid!) {
        olympus_weather_locations_aggregate(
          where: { userId: { _eq: $userId } }
        ) {
          aggregate {
            count
            max {
              position
            }
          }
        }
      }
    `;
    type CountResult = {
      olympus_weather_locations_aggregate: {
        aggregate: { count: number; max: { position: number | null } };
      };
    };
    const { aggregate } = (
      await this.graphQLClient.request<CountResult>(countDocument, { userId })
    ).olympus_weather_locations_aggregate;

    const document = gql`
      mutation CreateWeatherLocation(
        $object: olympus_weather_locations_insert_input!
      ) {
        insert_olympus_weather_locations_one(object: $object) {
          ${WEATHER_LOCATION}
        }
      }
    `;
    type Result = {
      insert_olympus_weather_locations_one: GraphQlWeatherLocation;
    };
    const result = await this.graphQLClient.request<Result>(document, {
      object: {
        userId,
        ...values,
        position: (aggregate.max.position ?? -1) + 1,
        isDefault: aggregate.count === 0,
      },
    });
    return toDomainObject(result.insert_olympus_weather_locations_one);
  }

  /**
   * Changes a location's label or default. Making one the default clears the
   * old default in the same transaction. Answers `undefined` when there is
   * nothing to change.
   */
  async update(
    userId: string,
    locationId: string,
    changes: PartialWeatherLocation | undefined,
  ): Promise<WeatherLocation | undefined> {
    const set = validatePartial(changes);
    // First, so a missing location is a 404 before anything is written.
    const current = await this.describe(userId, locationId);
    if (Object.keys(set).length === 0) return undefined;
    if (set.isDefault === current.isDefault) delete set.isDefault;
    if (set.label === current.label) delete set.label;
    if (Object.keys(set).length === 0) return current;

    type Result = {
      update_olympus_weather_locations: {
        returning: GraphQlWeatherLocation[];
      };
    };
    // Making a location the default clears the old one first. Hasura runs a
    // mutation's root fields in order, in one transaction, which the
    // one-default index requires. Otherwise nothing else is touched, so no
    // other location's lastUpdatedTime moves.
    const document =
      set.isDefault === true
        ? gql`
      mutation SetDefaultWeatherLocation(
        $userId: uuid!
        $locationId: uuid!
        $set: olympus_weather_locations_set_input!
      ) {
        clear: update_olympus_weather_locations(
          where: {
            userId: { _eq: $userId }
            isDefault: { _eq: true }
            id: { _neq: $locationId }
          }
          _set: { isDefault: false }
        ) {
          affected_rows
        }
        update_olympus_weather_locations(
          where: { id: { _eq: $locationId }, userId: { _eq: $userId } }
          _set: $set
        ) {
          returning {
            ${WEATHER_LOCATION}
          }
        }
      }
    `
        : gql`
      mutation UpdateWeatherLocation(
        $userId: uuid!
        $locationId: uuid!
        $set: olympus_weather_locations_set_input!
      ) {
        update_olympus_weather_locations(
          where: { id: { _eq: $locationId }, userId: { _eq: $userId } }
          _set: $set
        ) {
          returning {
            ${WEATHER_LOCATION}
          }
        }
      }
    `;
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      locationId,
      set,
    });
    const row = result.update_olympus_weather_locations.returning[0];
    if (!row) throw notFound(locationId);
    return toDomainObject(row);
  }

  /** Removes one of the user's locations. */
  async delete(userId: string, locationId: string): Promise<void> {
    const document = gql`
      mutation DeleteWeatherLocation($userId: uuid!, $locationId: uuid!) {
        delete_olympus_weather_locations(
          where: { id: { _eq: $locationId }, userId: { _eq: $userId } }
        ) {
          affected_rows
        }
      }
    `;
    type Result = {
      delete_olympus_weather_locations: { affected_rows: number };
    };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      locationId,
    });
    if (result.delete_olympus_weather_locations.affected_rows === 0) {
      throw notFound(locationId);
    }
  }

  /**
   * Puts the user's locations in the order given, which must name every one
   * of them exactly once.
   */
  async reorder(
    userId: string,
    locationIds: string[] | undefined,
  ): Promise<WeatherLocation[]> {
    if (
      !Array.isArray(locationIds) ||
      locationIds.some((id) => typeof id !== "string")
    ) {
      throw new BadRequestException("locationIds must be a list of IDs");
    }
    const current = await this.list(userId);
    const given = new Set(locationIds);
    if (
      given.size !== locationIds.length ||
      given.size !== current.length ||
      current.some((location) => !given.has(location.id))
    ) {
      throw new BadRequestException(
        "locationIds must name each of your locations exactly once",
      );
    }

    // The position constraint is deferred, so the rows may collide on the
    // way to their new places and are checked when the mutation commits.
    const document = gql`
      mutation ReorderWeatherLocations(
        $updates: [olympus_weather_locations_updates!]!
      ) {
        update_olympus_weather_locations_many(updates: $updates) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(document, {
      updates: locationIds.map((id, position) => ({
        where: { id: { _eq: id }, userId: { _eq: userId } },
        _set: { position },
      })),
    });
    return this.list(userId);
  }
}

const notFound = (locationId: string) =>
  new NotFoundException(`Weather location with id ${locationId} not found`);

type BaseValues = {
  label: string;
  placeId: string | null;
  placeName: string | null;
  latitude: number;
  longitude: number;
};

/**
 * The global ValidationPipe is off (docs/conventions/model.md), and these
 * values reach the database, so they are checked here.
 */
const validateBase = (
  location: BaseWeatherLocation | undefined,
): BaseValues => {
  if (!location || typeof location !== "object") {
    throw new BadRequestException("weatherLocation is required");
  }
  const problems: string[] = [];
  const label = checkLabel(location.label, problems);
  const latitude = checkDegrees(location.latitude, "latitude", 90, problems);
  const longitude = checkDegrees(
    location.longitude,
    "longitude",
    180,
    problems,
  );
  const placeId = checkOptionalText(location.placeId, "placeId", problems);
  const placeName = checkOptionalText(
    location.placeName,
    "placeName",
    problems,
  );
  if (problems.length) throw new BadRequestException(problems);
  return { label, placeId, placeName, latitude, longitude };
};

const validatePartial = (
  changes: PartialWeatherLocation | undefined,
): { label?: string; isDefault?: boolean } => {
  if (!changes || typeof changes !== "object") {
    throw new BadRequestException("weatherLocation is required");
  }
  const problems: string[] = [];
  const set: { label?: string; isDefault?: boolean } = {};
  if (changes.label !== undefined) {
    set.label = checkLabel(changes.label, problems);
  }
  if (changes.isDefault !== undefined) {
    if (typeof changes.isDefault !== "boolean") {
      problems.push("isDefault must be true or false");
    } else {
      set.isDefault = changes.isDefault;
    }
  }
  if (problems.length) throw new BadRequestException(problems);
  return set;
};

const checkLabel = (value: unknown, problems: string[]): string => {
  const label = typeof value === "string" ? value.trim() : "";
  if (!label || label.length > MAX_LABEL) {
    problems.push(`label must be 1 to ${MAX_LABEL} characters`);
  }
  return label;
};

const checkDegrees = (
  value: unknown,
  name: string,
  limit: number,
  problems: string[],
): number => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > limit
  ) {
    problems.push(`${name} must be a number from -${limit} to ${limit}`);
    return 0;
  }
  return value;
};

const checkOptionalText = (
  value: unknown,
  name: string,
  problems: string[],
): string | null => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_PLACE_TEXT) {
    problems.push(
      `${name} must be text of at most ${MAX_PLACE_TEXT} characters`,
    );
    return null;
  }
  return value;
};
