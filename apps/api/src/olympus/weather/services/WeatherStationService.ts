import {
  BaseWeatherStation,
  PartialWeatherStation,
  WeatherStation,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ClientError, gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../../config/configuration";
import {
  GraphQlWeatherStation,
  toDomainObject,
} from "../converters/WeatherStationConverter";
import {
  WEATHER_STATION,
  WEATHER_STATION_WITH_LATEST,
} from "../queries/weatherStations";
import { normalizeMac } from "../stations/ambientReport";

/** How long a MAC's lookup is trusted: a push comes every ~16 seconds. */
const BY_MAC_TTL_MS = 60_000;
const MAX_NAME = 100;

/**
 * The house's stations in Hasura. Registration is an admin's; every
 * signed-in user can list them, each with its newest reading and whether
 * it is reporting (a reading within WEATHER_STATION_STALE_SECONDS). Pushes look a station up by MAC often, so
 * that lookup is cached briefly and forgotten on any change.
 */
@Injectable()
export class WeatherStationService {
  private readonly byMac = new Map<
    string,
    { station: WeatherStation | undefined; at: number }
  >();

  constructor(
    private readonly graphQLClient: GraphQLClient,
    @Inject(weatherConfig.KEY) private readonly weather: WeatherConfigType,
  ) {}

  /** Whether a station is reporting, as of now. */
  private get reporting() {
    return {
      now: moment.utc(),
      staleSeconds: this.weather.stations.staleSeconds,
    };
  }

  async list(): Promise<WeatherStation[]> {
    const document = gql`
      query ListWeatherStations {
        olympus_weather_stations(order_by: { name: asc }) {
          ${WEATHER_STATION_WITH_LATEST}
        }
      }
    `;
    type Result = { olympus_weather_stations: GraphQlWeatherStation[] };
    const result = await this.graphQLClient.request<Result>(document);
    const context = this.reporting;
    return result.olympus_weather_stations.map((row) =>
      toDomainObject(row, context),
    );
  }

  async describe(stationId: string): Promise<WeatherStation> {
    const document = gql`
      query DescribeWeatherStation($stationId: uuid!) {
        olympus_weather_stations_by_pk(id: $stationId) {
          ${WEATHER_STATION_WITH_LATEST}
        }
      }
    `;
    type Result = {
      olympus_weather_stations_by_pk: GraphQlWeatherStation | null;
    };
    const result = await this.graphQLClient.request<Result>(document, {
      stationId,
    });
    if (!result.olympus_weather_stations_by_pk) throw notFound(stationId);
    return toDomainObject(
      result.olympus_weather_stations_by_pk,
      this.reporting,
    );
  }

  /** The station a console belongs to, or undefined for an unknown MAC. */
  async findByMac(macAddress: string): Promise<WeatherStation | undefined> {
    const cached = this.byMac.get(macAddress);
    if (cached && Date.now() - cached.at < BY_MAC_TTL_MS) return cached.station;
    const document = gql`
      query GetWeatherStationByMac($macAddress: macaddr!) {
        olympus_weather_stations(
          where: { macAddress: { _eq: $macAddress } }
          limit: 1
        ) {
          ${WEATHER_STATION}
        }
      }
    `;
    type Result = { olympus_weather_stations: GraphQlWeatherStation[] };
    const result = await this.graphQLClient.request<Result>(document, {
      macAddress,
    });
    const row = result.olympus_weather_stations[0];
    const station = row ? toDomainObject(row) : undefined;
    this.byMac.set(macAddress, { station, at: Date.now() });
    return station;
  }

  async create(
    station: BaseWeatherStation | undefined,
  ): Promise<WeatherStation> {
    if (!station || typeof station !== "object") {
      throw new BadRequestException("weatherStation is required");
    }
    const name = checkName(station.name);
    const macAddress = normalizeMac(
      typeof station.macAddress === "string" ? station.macAddress : undefined,
    );
    if (!macAddress) {
      throw new BadRequestException(
        "macAddress must be a MAC address, e.g. A0:B1:C2:D3:E4:F5",
      );
    }
    const document = gql`
      mutation CreateWeatherStation(
        $object: olympus_weather_stations_insert_input!
      ) {
        insert_olympus_weather_stations_one(object: $object) {
          ${WEATHER_STATION}
        }
      }
    `;
    type Result = {
      insert_olympus_weather_stations_one: GraphQlWeatherStation;
    };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        object: { name, macAddress },
      });
      this.byMac.clear();
      return toDomainObject(result.insert_olympus_weather_stations_one);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `A station with MAC address ${macAddress} is already registered`,
        );
      }
      throw error;
    }
  }

  async update(
    stationId: string,
    changes: PartialWeatherStation | undefined,
  ): Promise<WeatherStation | undefined> {
    if (!changes || typeof changes !== "object") {
      throw new BadRequestException("weatherStation is required");
    }
    if (changes.name === undefined) return undefined;
    const name = checkName(changes.name);
    const document = gql`
      mutation UpdateWeatherStation($stationId: uuid!, $name: String!) {
        update_olympus_weather_stations_by_pk(
          pk_columns: { id: $stationId }
          _set: { name: $name }
        ) {
          ${WEATHER_STATION}
        }
      }
    `;
    type Result = {
      update_olympus_weather_stations_by_pk: GraphQlWeatherStation | null;
    };
    const result = await this.graphQLClient.request<Result>(document, {
      stationId,
      name,
    });
    if (!result.update_olympus_weather_stations_by_pk) {
      throw notFound(stationId);
    }
    this.byMac.clear();
    return toDomainObject(result.update_olympus_weather_stations_by_pk);
  }

  /** Removes a station and, by cascade, its samples. The archive stays. */
  async delete(stationId: string): Promise<void> {
    const document = gql`
      mutation DeleteWeatherStation($stationId: uuid!) {
        delete_olympus_weather_stations_by_pk(id: $stationId) {
          id
        }
      }
    `;
    type Result = {
      delete_olympus_weather_stations_by_pk: { id: string } | null;
    };
    const result = await this.graphQLClient.request<Result>(document, {
      stationId,
    });
    if (!result.delete_olympus_weather_stations_by_pk) {
      throw notFound(stationId);
    }
    this.byMac.clear();
  }
}

const notFound = (stationId: string) =>
  new NotFoundException(`Weather station with id ${stationId} not found`);

const checkName = (value: unknown): string => {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > MAX_NAME) {
    throw new BadRequestException(`name must be 1 to ${MAX_NAME} characters`);
  }
  return name;
};

const isUniqueViolation = (error: unknown) =>
  error instanceof ClientError &&
  (error.response.errors ?? []).some(
    (e) =>
      (e.extensions as { code?: string } | undefined)?.code ===
      "constraint-violation",
  );
