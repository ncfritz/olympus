import { Module } from "@nestjs/common";
import { CreateMetadataFetchJobController } from "../controller/dionysus/job/metadata/CreateMetadataFetchJob";
import { DeleteMetadataFetchJobController } from "../controller/dionysus/job/metadata/DeleteMetadataFetchJob";
import { DescribeMetadataFetchJobController } from "../controller/dionysus/job/metadata/DescribeMetadataFetchJob";
import { GetMetadataFetchJobStatisticsController } from "../controller/dionysus/job/metadata/GetMetadataFetchJobStatistics";
import { ListMetadataFetchJobsController } from "../controller/dionysus/job/metadata/ListMetadataFetchJobs";
import { ScrollMetadataFetchJobsController } from "../controller/dionysus/job/metadata/ScrollMetadataFetchJobs";
import { UpdateMetadataFetchJobController } from "../controller/dionysus/job/metadata/UpdateMetadataFetchJob";
import { CreateCertificationController } from "../controller/dionysus/metadata/certification/CreateCertification";
import { ListCertificationsController } from "../controller/dionysus/metadata/certification/ListCertifications";
import { CreateCollectionController } from "../controller/dionysus/metadata/collection/CreateCollection";
import { DescribeCollectionController } from "../controller/dionysus/metadata/collection/DescribeCollection";
import { CreateCountryController } from "../controller/dionysus/metadata/country/CreateCountry";
import { ListCountriesController } from "../controller/dionysus/metadata/country/ListCountries";
import { CreateGenreController } from "../controller/dionysus/metadata/genre/CreateGenre";
import { ListGenresController } from "../controller/dionysus/metadata/genre/ListGenres";
import { CreateKeywordController } from "../controller/dionysus/metadata/keyword/CreateKeyword";
import { ListKeywordsController } from "../controller/dionysus/metadata/keyword/ListKeywords";
import { CreateLanguageController } from "../controller/dionysus/metadata/language/CreateLanguage";
import { ListLanguagesController } from "../controller/dionysus/metadata/language/ListLanguages";
import { CreateMovieController } from "../controller/dionysus/metadata/movie/CreateMovie";
import { DescribeMovieController } from "../controller/dionysus/metadata/movie/DescribeMovie";
import { GetMovieAggregateStatisticsController } from "../controller/dionysus/metadata/movie/GetMovieAggregateStatistics";
import { GetMovieLocationStatisticsController } from "../controller/dionysus/metadata/movie/GetMovieLocationStatistics";
import { GetMovieReleaseStatusStatisticsController } from "../controller/dionysus/metadata/movie/GetMovieReleaseStatusStatistics";
import { GetMovieReleaseYearStatisticsController } from "../controller/dionysus/metadata/movie/GetMovieReleaseYearStatistics";
import { GetMovieRuntimeStatisticsController } from "../controller/dionysus/metadata/movie/GetMovieRuntimeStatistics";
import { ListMovieCastController } from "../controller/dionysus/metadata/movie/ListMovieCast";
import { ListMovieCollectionsController } from "../controller/dionysus/metadata/movie/ListMovieCollections";
import { ListMovieCrewController } from "../controller/dionysus/metadata/movie/ListMovieCrew";
import { ListMovieRecommendationsController } from "../controller/dionysus/metadata/movie/ListMovieRecommendations";
import { ListMoviesController } from "../controller/dionysus/metadata/movie/ListMovies";
import { CreateNetworkController } from "../controller/dionysus/metadata/network/CreateNetwork";
import { DescribeNetworkController } from "../controller/dionysus/metadata/network/DescribeNetwork";
import { ListNetworksController } from "../controller/dionysus/metadata/network/ListNetworks";
import { ListNetworkTvSeriesController } from "../controller/dionysus/metadata/network/ListNetworkTvSeries";
import { CreatePersonController } from "../controller/dionysus/metadata/person/CreatePerson";
import { DescribePersonController } from "../controller/dionysus/metadata/person/DescribePerson";
import { GetPeopleBirthdayStatisticsController } from "../controller/dionysus/metadata/person/GetPersonBirthdayStatistics";
import { GetPeopleDeathdayStatisticsController } from "../controller/dionysus/metadata/person/GetPersonDeathdayStatistics";
import { GetPeopleDepartmentStatisticsController } from "../controller/dionysus/metadata/person/GetPersonDepartmentStatistics";
import { ListMovieCastRolesForPersonController } from "../controller/dionysus/metadata/person/ListMovieCastRolesForPerson";
import { ListMovieCrewJobsForPersonController } from "../controller/dionysus/metadata/person/ListMovieCrewJobsForPerson";
import { ListPeopleController } from "../controller/dionysus/metadata/person/ListPeople";
import { CreateProductionCompanyController } from "../controller/dionysus/metadata/productionCompany/CreateProductionCompany";
import { DescribeProductionCompanyController } from "../controller/dionysus/metadata/productionCompany/DescribeProductionCompany";
import { ListProductionCompaniesController } from "../controller/dionysus/metadata/productionCompany/ListProductionCompanies";
import { ListProductionCompanyMoviesController } from "../controller/dionysus/metadata/productionCompany/ListProductionCompanyMovies";
import { ListProductionCompanyTvSeriesController } from "../controller/dionysus/metadata/productionCompany/ListProductionCompanyTvSeries";
import { CreateTVEpisodeController } from "../controller/dionysus/metadata/tv/CreateTVEpisode";
import { CreateTVSeasonController } from "../controller/dionysus/metadata/tv/CreateTVSeason";
import { CreateTVSeriesController } from "../controller/dionysus/metadata/tv/CreateTVSeries";
import { DescribeTvEpisodeController } from "../controller/dionysus/metadata/tv/DescribeTvEpisode";
import { DescribeTvSeasonController } from "../controller/dionysus/metadata/tv/DescribeTvSeason";
import { DescribeTvSeriesController } from "../controller/dionysus/metadata/tv/DescribeTvSeries";
import { GetTvSeriesAggregateStatisticsController } from "../controller/dionysus/metadata/tv/GetTvSeriesAggregateStatistics";
import { GetTvSeriesEpisodeRuntimeStatisticsController } from "../controller/dionysus/metadata/tv/GetTvSeriesEpisodeRuntimeStatistics";
import { GetTvSeriesFirstAirYearStatisticsController } from "../controller/dionysus/metadata/tv/GetTvSeriesFirstAirYearStatistics";
import { GetTvSeriesLocationStatisticsController } from "../controller/dionysus/metadata/tv/GetTvSeriesLocationStatistics";
import { GetTvSeriesSeasonStatisticsController } from "../controller/dionysus/metadata/tv/GetTvSeriesSeasonStatistics";
import { GetTvSeriesStatusStatisticsController } from "../controller/dionysus/metadata/tv/GetTvSeriesStatusStatistics";
import { ListTvEpisodeCastController } from "../controller/dionysus/metadata/tv/ListTvEpisodeCast";
import { ListTvEpisodeCrewController } from "../controller/dionysus/metadata/tv/ListTvEpisodeCrew";
import { ListTvEpisodeGuestStarsController } from "../controller/dionysus/metadata/tv/ListTvEpisodeGuestStars";
import { ListTvSeasonCastController } from "../controller/dionysus/metadata/tv/ListTvSeasonCast";
import { ListTvSeasonCrewController } from "../controller/dionysus/metadata/tv/ListTvSeasonCrew";
import { ListTvSeriesController } from "../controller/dionysus/metadata/tv/ListTvSeries";
import { ListTvSeriesCastController } from "../controller/dionysus/metadata/tv/ListTvSeriesCast";
import { ListTvSeriesCrewController } from "../controller/dionysus/metadata/tv/ListTvSeriesCrew";
import { ListTvSeriesRecommendationsController } from "../controller/dionysus/metadata/tv/ListTvSeriesRecommendations";
import { GraphQLClientModule } from "./GraphQLClientModule";
import { RabbitModule } from "./RabbitModule";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
    CreateCertificationController,
    CreateCollectionController,
    CreateCountryController,
    CreateGenreController,
    CreateKeywordController,
    CreateLanguageController,
    CreateMetadataFetchJobController,
    CreateNetworkController,
    CreateMovieController,
    CreatePersonController,
    CreateProductionCompanyController,
    CreateTVEpisodeController,
    CreateTVSeasonController,
    CreateTVSeriesController,
    DescribeCollectionController,
    DeleteMetadataFetchJobController,
    DescribeMetadataFetchJobController,
    DescribeMovieController,
    DescribeNetworkController,
    DescribePersonController,
    DescribeProductionCompanyController,
    DescribeTvEpisodeController,
    DescribeTvSeasonController,
    DescribeTvSeriesController,
    GetMetadataFetchJobStatisticsController,
    GetMovieAggregateStatisticsController,
    GetMovieLocationStatisticsController,
    GetMovieReleaseStatusStatisticsController,
    GetMovieReleaseYearStatisticsController,
    GetMovieRuntimeStatisticsController,
    GetPeopleBirthdayStatisticsController,
    GetPeopleDeathdayStatisticsController,
    GetPeopleDepartmentStatisticsController,
    GetTvSeriesAggregateStatisticsController,
    GetTvSeriesLocationStatisticsController,
    GetTvSeriesStatusStatisticsController,
    GetTvSeriesFirstAirYearStatisticsController,
    GetTvSeriesEpisodeRuntimeStatisticsController,
    GetTvSeriesSeasonStatisticsController,
    ListCertificationsController,
    ListCountriesController,
    ListGenresController,
    ListKeywordsController,
    ListLanguagesController,
    ListMoviesController,
    ListNetworksController,
    ListNetworkTvSeriesController,
    ListPeopleController,
    ListProductionCompaniesController,
    ListProductionCompanyMoviesController,
    ListProductionCompanyTvSeriesController,
    ListMovieCastController,
    ListMovieCollectionsController,
    ListMovieCrewController,
    ListMovieCastRolesForPersonController,
    ListMovieCrewJobsForPersonController,
    ListMovieRecommendationsController,
    ListMetadataFetchJobsController,
    ListTvEpisodeCrewController,
    ListTvEpisodeCastController,
    ListTvEpisodeGuestStarsController,
    ListTvSeasonCastController,
    ListTvSeasonCrewController,
    ListTvSeriesController,
    ListTvSeriesCastController,
    ListTvSeriesCrewController,
    ListTvSeriesRecommendationsController,
    ScrollMetadataFetchJobsController,
    UpdateMetadataFetchJobController,
  ],
})
export class MetadataApiModule {}
