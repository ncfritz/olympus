import { Module } from "@nestjs/common";
import { MovieService } from "./services/MovieService";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateMovieController } from "./controllers/CreateMovieController";
import { DescribeMovieController } from "./controllers/DescribeMovieController";
import { GetMovieAggregateStatisticsController } from "./controllers/GetMovieAggregateStatisticsController";
import { GetMovieLocationStatisticsController } from "./controllers/GetMovieLocationStatisticsController";
import { GetMovieReleaseStatusStatisticsController } from "./controllers/GetMovieReleaseStatusStatisticsController";
import { GetMovieReleaseYearStatisticsController } from "./controllers/GetMovieReleaseYearStatisticsController";
import { GetMovieRuntimeStatisticsController } from "./controllers/GetMovieRuntimeStatisticsController";
import { ListMovieCastController } from "./controllers/ListMovieCastController";
import { ListMovieCollectionsController } from "./controllers/ListMovieCollectionsController";
import { ListMovieCrewController } from "./controllers/ListMovieCrewController";
import { ListMovieRecommendationsController } from "./controllers/ListMovieRecommendationsController";
import { ListMoviesController } from "./controllers/ListMoviesController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [MovieService],
  controllers: [
    CreateMovieController,
    DescribeMovieController,
    GetMovieAggregateStatisticsController,
    GetMovieLocationStatisticsController,
    GetMovieReleaseStatusStatisticsController,
    GetMovieReleaseYearStatisticsController,
    GetMovieRuntimeStatisticsController,
    ListMovieCastController,
    ListMovieCollectionsController,
    ListMovieCrewController,
    ListMovieRecommendationsController,
    ListMoviesController,
  ],
})
export class MoviesModule {}
