import { Inject, Logger, Module, type OnModuleInit } from "@nestjs/common";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../config/configuration";

/**
 * Weather: forecasts, map tiles and the house's stations (ADR 0024,
 * docs/plans/weather/README.md). The operations arrive phase by phase.
 */
@Module({})
export class WeatherModule implements OnModuleInit {
  private readonly logger = new Logger(WeatherModule.name);

  constructor(
    @Inject(weatherConfig.KEY) private readonly weather: WeatherConfigType,
  ) {}

  onModuleInit(): void {
    if (!this.weather.openWeatherApiKey) {
      this.logger.warn(
        "OPENWEATHER_API_KEY is not set: forecasts and map layers will answer 503",
      );
    }
    if (this.weather.stations.allowedCidrs.length === 0) {
      this.logger.warn(
        "WEATHER_STATION_ALLOWED_CIDRS is empty: station pushes will be refused",
      );
    }
  }
}
