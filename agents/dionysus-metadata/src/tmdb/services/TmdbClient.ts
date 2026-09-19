import { ExecuteWithMetrics } from "@ncfritz/olympus-nest";
import { Inject, Injectable } from "@nestjs/common";
import {
  AppendToResponseTvKey,
  type EpisodeSelection,
  type LanguageOption,
  PageOption,
  type SeasonSelection,
} from "tmdb-ts";
import {
  CertificationEndpoint,
  CollectionsEndpoint,
  GenreEndpoint,
  MoviesEndpoint,
  TvEpisodesEndpoint,
  TvSeasonsEndpoint,
  TvShowsEndpoint,
} from "tmdb-ts/dist/endpoints";
import {
  BackOffPolicy,
  ExponentialBackoffStrategy,
  Retryable,
  RetryOptions,
} from "typescript-retry-decorator";
import type { TmdbConfigType } from "../../config/configuration";
import { tmdbConfig } from "../../config/configuration";
import { ConfigurationEndpoint } from "../endpoints/ConfigurationEndpoint";
import { NetworksEndpoint } from "../endpoints/NetworksEndpoint";
import { PersonEndpoint } from "../endpoints/PersonEndpoint";
import { ProductionCompaniesEndpoint } from "../endpoints/ProductionCompaniesEndpoint";

// https://developer.themoviedb.org/docs/errors
const RETRYABLE_ERRORS = [
  46, // The API is undergoing maintenance. Try again later.
  43, // Couldn't connect to the backend server.
  25, // Your request count (#) is over the allowed limit of (40).
  24, // Your request to the backend server timed out. Try again.
  15, // Failed.
  9, // Service offline: This service is temporarily offline, try again later.
];

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  backOff: 500,
  backOffPolicy: BackOffPolicy.ExponentialBackOffPolicy,
  exponentialOption: {
    backoffStrategy: ExponentialBackoffStrategy.FullJitter,
    maxInterval: 2000,
    multiplier: 2,
  },
  doRetry: (error: { status_code?: number }) => {
    return RETRYABLE_ERRORS.includes(error?.status_code || 0);
  },
};

/**
 * TMDB's API: tmdb-ts endpoints plus our own for what it lacks. Calls
 * retry TMDB's transient errors with backoff and record client metrics.
 */
@Injectable()
export class TmdbClient {
  // TMDB standard endpoints
  private readonly certificationEndpoint: CertificationEndpoint;
  private readonly collectionsEndpoint: CollectionsEndpoint;
  private readonly genresEndpoint: GenreEndpoint;
  private readonly movieEndpoint: MoviesEndpoint;
  private readonly tvEpisodesEndpoint: TvEpisodesEndpoint;
  private readonly tvSeasonsEndpoint: TvSeasonsEndpoint;
  private readonly tvShowsEndpoint: TvShowsEndpoint;
  // Custom endpoints
  private readonly configurationEndpoint: ConfigurationEndpoint;
  private readonly networksEndpoint: NetworksEndpoint;
  private readonly personEndpoint: PersonEndpoint;
  private readonly productionCompaniesEndpoint: ProductionCompaniesEndpoint;

  constructor(@Inject(tmdbConfig.KEY) tmdb: TmdbConfigType) {
    const apiKey = tmdb.apiKey!;

    this.certificationEndpoint = new CertificationEndpoint(apiKey);
    this.collectionsEndpoint = new CollectionsEndpoint(apiKey);
    this.configurationEndpoint = new ConfigurationEndpoint(apiKey);
    this.genresEndpoint = new GenreEndpoint(apiKey);
    this.movieEndpoint = new MoviesEndpoint(apiKey);
    this.networksEndpoint = new NetworksEndpoint(apiKey);
    this.personEndpoint = new PersonEndpoint(apiKey);
    this.productionCompaniesEndpoint = new ProductionCompaniesEndpoint(apiKey);
    this.tvEpisodesEndpoint = new TvEpisodesEndpoint(apiKey);
    this.tvSeasonsEndpoint = new TvSeasonsEndpoint(apiKey);
    this.tvShowsEndpoint = new TvShowsEndpoint(apiKey);
  }

  // Certifications
  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Certifications.Movies")
  async getMovieCertifications() {
    return this.certificationEndpoint.movies();
  }

  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Certifications.TVShows")
  async getTvCertifications() {
    return this.certificationEndpoint.tvShows();
  }

  // Collections
  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Collection.Details")
  async getCollectionDetails(id: number) {
    return this.collectionsEndpoint.details(id);
  }

  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Collection.Images")
  async getCollectionImages(id: number) {
    return this.collectionsEndpoint.images(id);
  }

  // Configuration
  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Configuration.Countries")
  async listCountries() {
    return this.configurationEndpoint.countries();
  }

  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Configuration.Languages")
  async listLanguages() {
    return this.configurationEndpoint.languages();
  }

  // Genres
  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Genres.Movies")
  async getMovieGenres() {
    return this.genresEndpoint.movies();
  }

  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Genres.TVShows")
  async getTvShowGenres() {
    return this.genresEndpoint.tvShows();
  }

  // Movies
  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Movie.Details")
  async getMovieDetails(
    id: number,
    append?: (
      | "images"
      | "videos"
      | "credits"
      | "release_dates"
      | "alternative_titles"
      | "external_ids"
      | "keywords"
    )[],
    language?: string,
  ) {
    return this.movieEndpoint.details(id, append, language);
  }

  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Movie.Recommendations")
  async getMovieRecommendations(
    id: number,
    options?: LanguageOption & PageOption,
  ) {
    return this.movieEndpoint.recommendations(id, options);
  }

  // Network
  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Networks.Details")
  async getNetworkDetails(id: number) {
    return this.networksEndpoint.details(id);
  }

  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Networks.AlternativeNames")
  async getNetworkAlternativeNames(id: number) {
    return this.networksEndpoint.alternativeNames(id);
  }

  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Networks.Images")
  async getNetworkImages(id: number) {
    return this.networksEndpoint.images(id);
  }

  // Person
  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.Person.Details")
  async getPersonDetails(id: number, append?: ("images" | "external_ids")[]) {
    return this.personEndpoint.details(id, append);
  }

  // Production Companies
  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.ProductionCompanies.Details")
  async getProductionCompanyDetails(id: number) {
    return this.productionCompaniesEndpoint.details(id);
  }

  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.ProductionCompanies.AlternativeNames")
  async getProductionCompanyAlternativeNames(id: number) {
    return this.productionCompaniesEndpoint.alternativeNames(id);
  }

  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.ProductionCompanies.Images")
  async getProductionCompanyImages(id: number) {
    return this.productionCompaniesEndpoint.images(id);
  }

  // TV Episodes
  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.TvEpisode.Details")
  async getTvEpisodeDetails(
    episodeSelection: EpisodeSelection,
    append?: ("images" | "videos" | "credits" | "external_ids")[],
    language?: LanguageOption,
  ) {
    return this.tvEpisodesEndpoint.details(episodeSelection, append, language);
  }

  // TV Seasons
  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.TvSeasons.Details")
  async getTvSeasonDetails(
    seasonSelection: SeasonSelection,
    append?: ("images" | "external_ids" | "videos" | "aggregate_credits")[],
  ) {
    return this.tvSeasonsEndpoint.details(seasonSelection, append);
  }

  // TV Series
  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.TvSeries.Details")
  async getTvSeriesDetails(
    id: number,
    append?: AppendToResponseTvKey[],
    language?: string,
  ) {
    return this.tvShowsEndpoint.details(id, append, language);
  }

  @Retryable(DEFAULT_RETRY_OPTIONS)
  @ExecuteWithMetrics("TMDB.TvSeries.Recommendations")
  async getTvSeriesRecommendation(
    id: number,
    options: LanguageOption & PageOption,
  ) {
    return this.tvShowsEndpoint.recommendations(id, options);
  }
}
