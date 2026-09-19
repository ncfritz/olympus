import { Module } from "@nestjs/common";
import { ContentAssetsModule } from "./content/assets/ContentAssetsModule";
import { ContentAuthModule } from "./content/auth/ContentAuthModule";
import { ContentChannelsModule } from "./content/channels/ContentChannelsModule";
import { ContentTagsModule } from "./content/tags/ContentTagsModule";
import { ContentWorkflowsModule } from "./content/workflows/ContentWorkflowsModule";
import { BatchJobsModule } from "./jobs/batch/BatchJobsModule";
import { MetadataFetchJobsModule } from "./jobs/metadata/MetadataFetchJobsModule";
import { MediaAssetsModule } from "./media/assets/MediaAssetsModule";
import { MediaDownloadsModule } from "./media/downloads/MediaDownloadsModule";
import { MediaFavoritesModule } from "./media/favorites/MediaFavoritesModule";
import { MediaSearchConfigurationsModule } from "./media/searchConfigurations/MediaSearchConfigurationsModule";
import { MediaSearchExecutionsModule } from "./media/searchExecutions/MediaSearchExecutionsModule";
import { MediaSearchResultsModule } from "./media/searchResults/MediaSearchResultsModule";
import { MediaWorkflowsModule } from "./media/workflows/MediaWorkflowsModule";
import { CertificationsModule } from "./metadata/certifications/CertificationsModule";
import { CollectionsModule } from "./metadata/collections/CollectionsModule";
import { CountriesModule } from "./metadata/countries/CountriesModule";
import { GenresModule } from "./metadata/genres/GenresModule";
import { KeywordsModule } from "./metadata/keywords/KeywordsModule";
import { LanguagesModule } from "./metadata/languages/LanguagesModule";
import { MoviesModule } from "./metadata/movies/MoviesModule";
import { NetworksModule } from "./metadata/networks/NetworksModule";
import { PeopleModule } from "./metadata/people/PeopleModule";
import { ProductionCompaniesModule } from "./metadata/productionCompanies/ProductionCompaniesModule";
import { TvModule } from "./metadata/tv/TvModule";
import { MetadataWorkflowsModule } from "./workflows/MetadataWorkflowsModule";

/** Feature modules served under /dionysus, in OpenAPI document order. */
export const DIONYSUS_MODULES = [
  ContentAssetsModule,
  ContentAuthModule,
  ContentChannelsModule,
  ContentTagsModule,
  ContentWorkflowsModule,
  BatchJobsModule,
  MetadataFetchJobsModule,
  MediaAssetsModule,
  MediaDownloadsModule,
  MediaFavoritesModule,
  MediaSearchConfigurationsModule,
  MediaSearchExecutionsModule,
  MediaSearchResultsModule,
  MediaWorkflowsModule,
  CertificationsModule,
  CollectionsModule,
  CountriesModule,
  GenresModule,
  KeywordsModule,
  LanguagesModule,
  MoviesModule,
  NetworksModule,
  PeopleModule,
  ProductionCompaniesModule,
  TvModule,
  MetadataWorkflowsModule,
];

@Module({ imports: DIONYSUS_MODULES })
export class DionysusModule {}
