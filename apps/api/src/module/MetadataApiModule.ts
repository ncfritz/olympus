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
import { ListMovieCastController } from "../controller/dionysus/metadata/movie/ListMovieCast";
import { ListMovieCollectionsController } from "../controller/dionysus/metadata/movie/ListMovieCollections";
import { ListMovieCrewController } from "../controller/dionysus/metadata/movie/ListMovieCrew";
import { ListMovieRecommendationsController } from "../controller/dionysus/metadata/movie/ListMovieRecommendations";
import { CreateNetworkController } from "../controller/dionysus/metadata/network/CreateNetwork";
import { DescribeNetworkController } from "../controller/dionysus/metadata/network/DescribeNetwork";
import { ListNetworksController } from "../controller/dionysus/metadata/network/ListNetworks";
import { ListNetworkTvSeriesController } from "../controller/dionysus/metadata/network/ListNetworkTvSeries";
import { CreatePersonController } from "../controller/dionysus/metadata/person/CreatePerson";
import { DescribePersonController } from "../controller/dionysus/metadata/person/DescribePerson";
import { ListMovieCastRolesForPersonController } from "../controller/dionysus/metadata/person/ListMovieCastRolesForPerson";
import { ListMovieCrewJobsForPersonController } from "../controller/dionysus/metadata/person/ListMovieCrewJobsForPerson";
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
import { ListTvEpisodeCastController } from "../controller/dionysus/metadata/tv/ListTvEpisodeCast";
import { ListTvEpisodeCrewController } from "../controller/dionysus/metadata/tv/ListTvEpisodeCrew";
import { ListTvEpisodeGuestStarsController } from "../controller/dionysus/metadata/tv/ListTvEpisodeGuestStars";
import { ListTvSeasonCastController } from "../controller/dionysus/metadata/tv/ListTvSeasonCast";
import { ListTvSeasonCrewController } from "../controller/dionysus/metadata/tv/ListTvSeasonCrew";
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
    ListCertificationsController,
    ListCountriesController,
    ListGenresController,
    ListKeywordsController,
    ListLanguagesController,
    ListNetworksController,
    ListNetworkTvSeriesController,
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
    ListTvSeriesCastController,
    ListTvSeriesCrewController,
    ListTvSeriesRecommendationsController,
    ScrollMetadataFetchJobsController,
    UpdateMetadataFetchJobController,
  ],
})
export class MetadataApiModule {}
