import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateTVSeriesController } from "./controllers/CreateTVSeriesController";
import { CreateTVSeriesEpisodeController } from "./controllers/CreateTVSeriesEpisodeController";
import { CreateTVSeriesSeasonController } from "./controllers/CreateTVSeriesSeasonController";
import { DescribeTvEpisodeController } from "./controllers/DescribeTvEpisodeController";
import { DescribeTvSeasonController } from "./controllers/DescribeTvSeasonController";
import { DescribeTvSeriesController } from "./controllers/DescribeTvSeriesController";
import { GetTvEpisodeByIdController } from "./controllers/GetTvEpisodeByIdController";
import { GetTvSeriesAggregateStatisticsController } from "./controllers/GetTvSeriesAggregateStatisticsController";
import { GetTvSeriesEpisodeRuntimeStatisticsController } from "./controllers/GetTvSeriesEpisodeRuntimeStatisticsController";
import { GetTvSeriesFirstAirYearStatisticsController } from "./controllers/GetTvSeriesFirstAirYearStatisticsController";
import { GetTvSeriesLocationStatisticsController } from "./controllers/GetTvSeriesLocationStatisticsController";
import { GetTvSeriesSeasonStatisticsController } from "./controllers/GetTvSeriesSeasonStatisticsController";
import { GetTvSeriesStatusStatisticsController } from "./controllers/GetTvSeriesStatusStatisticsController";
import { ListTvEpisodeCastController } from "./controllers/ListTvEpisodeCastController";
import { ListTvEpisodeCrewController } from "./controllers/ListTvEpisodeCrewController";
import { ListTvEpisodeGuestStarsController } from "./controllers/ListTvEpisodeGuestStarsController";
import { ListTvSeasonCastController } from "./controllers/ListTvSeasonCastController";
import { ListTvSeasonCrewController } from "./controllers/ListTvSeasonCrewController";
import { ListTvSeriesCastController } from "./controllers/ListTvSeriesCastController";
import { ListTvSeriesController } from "./controllers/ListTvSeriesController";
import { ListTvSeriesCrewController } from "./controllers/ListTvSeriesCrewController";
import { ListTvSeriesRecommendationsController } from "./controllers/ListTvSeriesRecommendationsController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [
    CreateTVSeriesController,
    CreateTVSeriesEpisodeController,
    CreateTVSeriesSeasonController,
    DescribeTvEpisodeController,
    DescribeTvSeasonController,
    DescribeTvSeriesController,
    GetTvEpisodeByIdController,
    GetTvSeriesAggregateStatisticsController,
    GetTvSeriesEpisodeRuntimeStatisticsController,
    GetTvSeriesFirstAirYearStatisticsController,
    GetTvSeriesLocationStatisticsController,
    GetTvSeriesSeasonStatisticsController,
    GetTvSeriesStatusStatisticsController,
    ListTvEpisodeCastController,
    ListTvEpisodeCrewController,
    ListTvEpisodeGuestStarsController,
    ListTvSeasonCastController,
    ListTvSeasonCrewController,
    ListTvSeriesCastController,
    ListTvSeriesController,
    ListTvSeriesCrewController,
    ListTvSeriesRecommendationsController,
  ],
})
export class TvModule {}
