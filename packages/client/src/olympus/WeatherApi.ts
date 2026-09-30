import {
  importWeatherStationReadings,
  type WeatherArchiveRecord,
} from "@ncfritz/olympus-sdk/olympus";
import type { OlympusClients } from "../clients";

/** Olympus weather, for agents. */
export class WeatherApi {
  constructor(private readonly clients: OlympusClients) {}

  /**
   * Stores raw station archive lines received elsewhere (the dev relay,
   * ADR 0025); answers what became of them.
   */
  async importWeatherStationReadings(records: WeatherArchiveRecord[]) {
    const response = await importWeatherStationReadings({
      client: this.clients.olympus,
      body: { records },
    });
    return response.data;
  }
}
