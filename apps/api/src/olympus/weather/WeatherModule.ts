import { Inject, Logger, Module, type OnModuleInit } from "@nestjs/common";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../config/configuration";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { CreateWeatherLocationController } from "./controllers/CreateWeatherLocationController";
import { DeleteWeatherLocationController } from "./controllers/DeleteWeatherLocationController";
import { DescribeWeatherLocationController } from "./controllers/DescribeWeatherLocationController";
import { ListWeatherLocationsController } from "./controllers/ListWeatherLocationsController";
import { ReorderWeatherLocationsController } from "./controllers/ReorderWeatherLocationsController";
import { UpdateWeatherLocationController } from "./controllers/UpdateWeatherLocationController";
import { WeatherLocationService } from "./services/WeatherLocationService";

/**
 * Weather: forecasts, map tiles and the house's stations (ADR 0024,
 * docs/plans/weather/README.md). Every operation is the signed-in user's
 * own: whose locations is never a parameter.
 */
@Module({
  imports: [GraphQLClientModule],
  providers: [WeatherLocationService],
  controllers: [
    ListWeatherLocationsController,
    ReorderWeatherLocationsController,
    CreateWeatherLocationController,
    DescribeWeatherLocationController,
    UpdateWeatherLocationController,
    DeleteWeatherLocationController,
  ],
})
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
