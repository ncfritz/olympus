import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateGenreController } from "./controllers/CreateGenreController";
import { GetMovieGenreCountStatisticsController } from "./controllers/GetMovieGenreCountStatisticsController";
import { GetMovieGenreStatisticsController } from "./controllers/GetMovieGenreStatisticsController";
import { GetTvSeriesGenreCountStatisticsController } from "./controllers/GetTvSeriesGenreCountStatisticsController";
import { GetTvSeriesGenreStatisticsController } from "./controllers/GetTvSeriesGenreStatisticsController";
import { ListGenresController } from "./controllers/ListGenresController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [
    CreateGenreController,
    GetMovieGenreCountStatisticsController,
    GetMovieGenreStatisticsController,
    GetTvSeriesGenreCountStatisticsController,
    GetTvSeriesGenreStatisticsController,
    ListGenresController,
  ],
})
export class GenresModule {}
