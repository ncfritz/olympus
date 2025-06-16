import { Module } from "@nestjs/common";
import { CreateCertificationController } from "../controller/metadata/CreateCertification";
import { CreateCollectionController } from "../controller/metadata/CreateCollection";
import { CreateCountryController } from "../controller/metadata/CreateCountry";
import { CreateGenreController } from "../controller/metadata/CreateGenre";
import { CreateKeywordController } from "../controller/metadata/CreateKeyword";
import { CreateLanguageController } from "../controller/metadata/CreateLanguage";
import { CreateMetadataFetchJobController } from "../controller/metadata/CreateMetadataFetchJob";
import { CreateMovieController } from "../controller/metadata/CreateMovie";
import { CreateNetworkController } from "../controller/metadata/CreateNetwork";
import { CreatePersonController } from "../controller/metadata/CreatePerson";
import { CreateProductionCompanyController } from "../controller/metadata/CreateProductionCompany";
import { CreateTVEpisodeController } from "../controller/metadata/CreateTVEpisode";
import { CreateTVSeasonController } from "../controller/metadata/CreateTVSeason";
import { CreateTVSeriesController } from "../controller/metadata/CreateTVSeries";
import { DeleteMetadataFetchJobController } from "../controller/metadata/DeleteMetadataFetchJob";
import { DescribeMetadataFetchJobController } from "../controller/metadata/DescribeMetadataFetchJob";
import { GetMetadataFetchJobStatisticsController } from "../controller/metadata/GetMetadataFetchJobStatistics";
import { ListCertificationsController } from "../controller/metadata/ListCertifications";
import { ListCountriesController } from "../controller/metadata/ListCountries";
import { ListGenresController } from "../controller/metadata/ListGenres";
import { ListKeywordsController } from "../controller/metadata/ListKeywords";
import { ListLanguagesController } from "../controller/metadata/ListLanguages";
import { ListMetadataFetchJobsController } from "../controller/metadata/ListMetadataFetchJobs";
import { ScrollMetadataFetchJobsController } from "../controller/metadata/ScrollMetadataFetchJobs";
import { UpdateMetadataFetchJobController } from "../controller/metadata/UpdateMetadataFetchJob";
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
    DeleteMetadataFetchJobController,
    DescribeMetadataFetchJobController,
    GetMetadataFetchJobStatisticsController,
    ListCertificationsController,
    ListCountriesController,
    ListGenresController,
    ListKeywordsController,
    ListLanguagesController,
    ListMetadataFetchJobsController,
    ScrollMetadataFetchJobsController,
    UpdateMetadataFetchJobController,
  ],
})
export class MetadataApiModule {}
