import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import type { Moment } from "moment";
import {
  type ForecastHistory,
  type GraphQlWeatherForecastStep,
  type GraphQlWeatherObservedTemperature,
  type Place,
  toForecastEntry,
  toObservedRow,
  toStepRow,
} from "../converters/WeatherForecastHistoryConverter";
import type { OpenWeatherSnapshot } from "../providers/openWeatherTypes";

/** How long a place's history is kept: today, wherever today is. */
export const HISTORY_HOURS = 48;

/**
 * Forecast history (ADR 0024): every fetch's steps and current temperature,
 * kept per place for two days, so a day is built from its passed hours as
 * well as the ones the forecast still has. A later fetch's step replaces
 * an earlier one's; an observation is kept once.
 */
@Injectable()
export class WeatherForecastHistoryService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** A fetch's steps and current temperature, for its place. */
  async record(
    place: Place,
    snapshot: OpenWeatherSnapshot,
    fetchedAt: Moment,
  ): Promise<void> {
    const document = gql`
      mutation SaveWeatherForecastHistory(
        $steps: [olympus_weather_forecast_steps_insert_input!]!
        $observed: olympus_weather_observed_temperatures_insert_input!
      ) {
        insert_olympus_weather_forecast_steps(
          objects: $steps
          on_conflict: {
            constraint: weather_forecast_steps_pkey
            update_columns: [
              temperatureF
              precipitationChance
              precipitationMm
              conditionId
              conditionMain
              conditionDescription
              conditionIcon
              fetchedTime
            ]
          }
        ) {
          affected_rows
        }
        insert_olympus_weather_observed_temperatures(
          objects: [$observed]
          on_conflict: {
            constraint: weather_observed_temperatures_pkey
            update_columns: []
          }
        ) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(document, {
      steps: snapshot.forecast.list.map((entry) =>
        toStepRow(place, entry, fetchedAt),
      ),
      observed: toObservedRow(place, snapshot.current),
    });
  }

  /** The place's steps and observations from `from` on. */
  async since(place: Place, from: Moment): Promise<ForecastHistory> {
    const document = gql`
      query ListWeatherForecastHistory(
        $latitude: numeric!
        $longitude: numeric!
        $from: timestamptz!
      ) {
        olympus_weather_forecast_steps(
          where: {
            latitude: { _eq: $latitude }
            longitude: { _eq: $longitude }
            stepTime: { _gte: $from }
          }
          order_by: { stepTime: asc }
        ) {
          stepTime
          temperatureF
          precipitationChance
          precipitationMm
          conditionId
          conditionMain
          conditionDescription
          conditionIcon
        }
        olympus_weather_observed_temperatures(
          where: {
            latitude: { _eq: $latitude }
            longitude: { _eq: $longitude }
            observedTime: { _gte: $from }
          }
        ) {
          observedTime
          temperatureF
        }
      }
    `;
    type Result = {
      olympus_weather_forecast_steps: GraphQlWeatherForecastStep[];
      olympus_weather_observed_temperatures: GraphQlWeatherObservedTemperature[];
    };
    const result = await this.graphQLClient.request<Result>(document, {
      latitude: place.latitude,
      longitude: place.longitude,
      from: from.toISOString(),
    });
    return {
      steps: result.olympus_weather_forecast_steps.map(toForecastEntry),
      temperaturesF: result.olympus_weather_observed_temperatures.map(
        (row) => row.temperatureF,
      ),
    };
  }

  /** Every place's history from before `before`. */
  async prune(before: Moment): Promise<void> {
    const document = gql`
      mutation PruneWeatherForecastHistory($before: timestamptz!) {
        delete_olympus_weather_forecast_steps(
          where: { stepTime: { _lt: $before } }
        ) {
          affected_rows
        }
        delete_olympus_weather_observed_temperatures(
          where: { observedTime: { _lt: $before } }
        ) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(document, {
      before: before.toISOString(),
    });
  }
}
