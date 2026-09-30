import {
  type BaseWeatherLocation,
  client,
  createWeatherLocation,
  deleteWeatherLocation,
  describeWeatherForecast,
  getRadarTile,
  getWeatherMapTile,
  listRadarFrames,
  listWeatherLocations,
  listWeatherStationSeries,
  listWeatherStations,
  type PartialWeatherLocation,
  type RadarFrame,
  reorderWeatherLocations,
  updateWeatherLocation,
  type WeatherForecast,
  type WeatherLocation,
  type WeatherMapLayer,
  type WeatherStation,
  type WeatherStationSeries,
} from "@ncfritz/olympus-sdk/olympus";

/**
 * Weather through the API (ADR 0024). Every call is the signed-in user's:
 * the access token the SDK client carries decides whose locations these
 * are. Tiles come back as blobs for the map to decode.
 */
class WeatherApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  async listLocations(): Promise<WeatherLocation[]> {
    const { data } = await listWeatherLocations();
    return data.weatherLocations;
  }

  async createLocation(
    location: BaseWeatherLocation,
  ): Promise<WeatherLocation> {
    const { data } = await createWeatherLocation({
      body: { weatherLocation: location },
    });
    return data.weatherLocation;
  }

  async updateLocation(
    locationId: string,
    changes: PartialWeatherLocation,
  ): Promise<void> {
    await updateWeatherLocation({
      path: { locationId },
      body: { weatherLocation: changes },
    });
  }

  async deleteLocation(locationId: string): Promise<void> {
    await deleteWeatherLocation({ path: { locationId } });
  }

  async reorderLocations(locationIds: string[]): Promise<WeatherLocation[]> {
    const { data } = await reorderWeatherLocations({ body: { locationIds } });
    return data.weatherLocations;
  }

  async describeForecast(locationId: string): Promise<WeatherForecast> {
    const { data } = await describeWeatherForecast({ path: { locationId } });
    return data.weatherForecast;
  }

  /** The house's stations, each with its newest reading. */
  async listStations(): Promise<WeatherStation[]> {
    const { data } = await listWeatherStations();
    return data.weatherStations;
  }

  /** A station's history: one series per metric, oldest point first. */
  async stationSeries(
    stationId: string,
    metrics: string[],
    from: Date,
    to: Date,
    resolution = "auto",
  ): Promise<WeatherStationSeries[]> {
    const { data } = await listWeatherStationSeries({
      path: { stationId },
      query: {
        metrics: metrics.join(","),
        from: from.toISOString(),
        to: to.toISOString(),
        resolution,
      },
    });
    return data.weatherStationSeries;
  }

  async listRadarFrames(): Promise<RadarFrame[]> {
    const { data } = await listRadarFrames();
    return data.radarFrames;
  }

  async mapTile(
    layer: WeatherMapLayer,
    z: number,
    x: number,
    y: number,
    signal?: AbortSignal,
  ): Promise<Blob> {
    const { data } = await getWeatherMapTile({
      path: { layer, z, x, y },
      signal,
    });
    return data as Blob;
  }

  async radarTile(
    frameId: string,
    z: number,
    x: number,
    y: number,
    signal?: AbortSignal,
  ): Promise<Blob> {
    const { data } = await getRadarTile({
      path: { frameId, z, x, y },
      signal,
    });
    return data as Blob;
  }
}

const weatherApi = new WeatherApi();
export default weatherApi;
