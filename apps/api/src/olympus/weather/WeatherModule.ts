import { Inject, Logger, Module, type OnModuleInit } from "@nestjs/common";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../config/configuration";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { CreateWeatherStationController } from "./controllers/CreateWeatherStationController";
import { DeleteWeatherStationController } from "./controllers/DeleteWeatherStationController";
import { DescribeWeatherStationController } from "./controllers/DescribeWeatherStationController";
import { ListWeatherStationsController } from "./controllers/ListWeatherStationsController";
import { ReplayWeatherArchiveController } from "./controllers/ReplayWeatherArchiveController";
import { ReportWeatherStationReadingController } from "./controllers/ReportWeatherStationReadingController";
import { UpdateWeatherStationController } from "./controllers/UpdateWeatherStationController";
import { StationReportService } from "./services/StationReportService";
import { WeatherIngestService } from "./services/WeatherIngestService";
import { WeatherReplayService } from "./services/WeatherReplayService";
import { WeatherRollupScheduler } from "./services/WeatherRollupScheduler";
import { WeatherRollupService } from "./services/WeatherRollupService";
import { WeatherStationService } from "./services/WeatherStationService";
import { StationArchive } from "./stations/StationArchive";
import { CreateWeatherLocationController } from "./controllers/CreateWeatherLocationController";
import { DeleteWeatherLocationController } from "./controllers/DeleteWeatherLocationController";
import { GetRadarTileController } from "./controllers/GetRadarTileController";
import { GetWeatherMapTileController } from "./controllers/GetWeatherMapTileController";
import { ListRadarFramesController } from "./controllers/ListRadarFramesController";
import { DescribeWeatherForecastController } from "./controllers/DescribeWeatherForecastController";
import { DescribeWeatherLocationController } from "./controllers/DescribeWeatherLocationController";
import { ListWeatherLocationsController } from "./controllers/ListWeatherLocationsController";
import { ReorderWeatherLocationsController } from "./controllers/ReorderWeatherLocationsController";
import { UpdateWeatherLocationController } from "./controllers/UpdateWeatherLocationController";
import { OpenWeatherClient } from "./providers/OpenWeatherClient";
import { OpenWeatherLimiter } from "./providers/OpenWeatherLimiter";
import { RainViewerClient } from "./providers/RainViewerClient";
import { WeatherForecastService } from "./services/WeatherForecastService";
import { WeatherLocationService } from "./services/WeatherLocationService";
import { WeatherTileService } from "./services/WeatherTileService";

/**
 * Weather: forecasts, map tiles and the house's stations (ADR 0024,
 * docs/plans/weather/README.md). Every operation is the signed-in user's
 * own: whose locations is never a parameter.
 */
@Module({
  imports: [GraphQLClientModule],
  providers: [
    WeatherLocationService,
    WeatherForecastService,
    OpenWeatherClient,
    OpenWeatherLimiter,
    RainViewerClient,
    WeatherTileService,
    WeatherStationService,
    StationReportService,
    StationArchive,
    WeatherIngestService,
    WeatherRollupService,
    WeatherReplayService,
    WeatherRollupScheduler,
  ],
  controllers: [
    ListWeatherLocationsController,
    ReorderWeatherLocationsController,
    CreateWeatherLocationController,
    DescribeWeatherLocationController,
    DescribeWeatherForecastController,
    ListRadarFramesController,
    GetRadarTileController,
    GetWeatherMapTileController,
    // The static /weather/station/report before /weather/station/:stationId.
    ReportWeatherStationReadingController,
    ListWeatherStationsController,
    CreateWeatherStationController,
    DescribeWeatherStationController,
    UpdateWeatherStationController,
    DeleteWeatherStationController,
    ReplayWeatherArchiveController,
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
