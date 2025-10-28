import {
  client,
  createMetadataFetchJob,
  deleteMetadataFetchJob,
  describeCollection,
  describeMetadataFetchJob,
  describeMovie,
  describeNetwork,
  describePerson,
  describeProductionCompany,
  describeTvEpisode,
  describeTvSeason,
  describeTvSeries,
  getMetadataFetchJobStatistics,
  getMovieAggregateStatistics,
  getMovieRuntimeStatistics,
  getMovieLocationStatistics,
  getMovieReleaseStatusStatistics,
  getMovieReleaseYearStatistics,
  getPeopleBirthdayStatistics,
  getPeopleDeathdayStatistics,
  getPeopleDepartmentStatistics,
  getTvSeriesLocationStatistics,
  listCertifications,
  listCountries,
  listGenres,
  listKeywords,
  listLanguages,
  listMetadataFetchJobs,
  listMovieCast,
  listMovieCastRolesForPerson,
  listMovieCollections,
  listMovieCrew,
  listMovieCrewJobsForPerson,
  listMovieRecommendations,
  listMovies,
  listNetworks,
  listNetworkTvSeries,
  listPeople,
  listProductionCompanies,
  listProductionCompanyMovies,
  listProductionCompanyTvSeries,
  listTvEpisodeCast,
  listTvEpisodeCrew,
  listTvEpisodeGuestStars,
  listTvSeasonCast,
  listTvSeasonCrew,
  listTvSeries,
  listTvSeriesCast,
  listTvSeriesCrew,
  listTvSeriesRecommendations,
  updateMetadataFetchJob,
  getTvSeriesStatusStatistics,
  getTvSeriesFirstAirYearStatistics,
  getTvSeriesEpisodeRuntimeStatistics,
  getTvSeriesSeasonStatistics,
  getTvSeriesAggregateStatistics,
  type MetadataFetchJobStatus,
  type MetadataJobType,
  type MetadatFetchJobUpdate,
  type FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import { ApiBase } from "./apiBase";
import type { SortOptions } from "./common";

class MetadataApi extends ApiBase {
  constructor() {
    super();

    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  async listCertifications(page: number, sort: SortOptions) {
    return await listCertifications({
      query: {
        pageSize: 20,
        startPage: page,
        sort: sort.order,
        sortBy: sort.field,
      },
    });
  }

  async listCountries(page: number, sort: SortOptions) {
    return await listCountries({
      query: {
        pageSize: 20,
        startPage: page,
        sort: sort.order,
        sortBy: sort.field,
      },
    });
  }

  async listGenres(page: number, sort: SortOptions) {
    return await listGenres({
      query: {
        pageSize: 20,
        startPage: page,
        sort: sort.order,
        sortBy: sort.field,
      },
    });
  }

  async listKeywords(page: number, sort: SortOptions) {
    return await listKeywords({
      query: {
        pageSize: 20,
        startPage: page,
        sort: sort.order,
        sortBy: sort.field,
      },
    });
  }

  async listLanguages(page: number, sort: SortOptions) {
    return await listLanguages({
      query: {
        pageSize: 20,
        startPage: page,
        sort: sort.order,
        sortBy: sort.field,
      },
    });
  }

  async describeCollection(id: number) {
    return describeCollection({
      path: {
        collectionId: id,
      },
    });
  }

  async describeTvSeries(id: number) {
    return describeTvSeries({
      path: {
        tvSeriesId: id,
      },
    });
  }

  async describeTvEpisode(
    id: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    return describeTvEpisode({
      path: {
        tvSeriesId: id,
        seasonNumber: seasonNumber,
        episodeNumber: episodeNumber,
      },
    });
  }

  async listTvEpisodeCrew(
    id: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    return listTvEpisodeCrew({
      path: {
        tvSeriesId: id,
        seasonNumber: seasonNumber,
        episodeNumber: episodeNumber,
      },
    });
  }

  async listTvEpisodeCast(
    id: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    return listTvEpisodeCast({
      path: {
        tvSeriesId: id,
        seasonNumber: seasonNumber,
        episodeNumber: episodeNumber,
      },
    });
  }

  async listTvEpisodeGuestStars(
    id: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    return listTvEpisodeGuestStars({
      path: {
        tvSeriesId: id,
        seasonNumber: seasonNumber,
        episodeNumber: episodeNumber,
      },
    });
  }

  async describeMovie(id: number) {
    return describeMovie({
      path: {
        movieId: id,
      },
    });
  }

  async describeTvSeason(seriesId: number, seasonNumber: number) {
    return describeTvSeason({
      path: {
        tvSeriesId: seriesId,
        seasonNumber: seasonNumber,
      },
    });
  }

  async listMovieCrew(id: number) {
    return listMovieCrew({
      path: {
        movieId: id,
      },
    });
  }

  async listMovieRecommendations(id: number) {
    return listMovieRecommendations({
      path: {
        movieId: id,
      },
    });
  }

  async listMovieCollections(id: number) {
    return listMovieCollections({
      path: {
        movieId: id,
      },
    });
  }

  async listMovieCast(id: number) {
    return listMovieCast({
      path: {
        movieId: id,
      },
    });
  }

  async describePerson(id: number) {
    return describePerson({
      path: {
        personId: id,
      },
    });
  }

  async listMovieCastRolesForPerson(id: number) {
    return await listMovieCastRolesForPerson({
      path: {
        personId: id,
      },
    });
  }

  async getPeopleBirthdayStatistics() {
    return await getPeopleBirthdayStatistics({});
  }

  async getPeopleDeathdayStatistics() {
    return await getPeopleDeathdayStatistics({});
  }

  async getPeopleDepartmentStatistics() {
    return await getPeopleDepartmentStatistics({});
  }

  async listMovieCrewJobsForPerson(id: number) {
    return await listMovieCrewJobsForPerson({
      path: {
        personId: id,
      },
    });
  }

  async describeProductionCompany(id: number) {
    return describeProductionCompany({
      path: {
        productionCompanyId: id,
      },
    });
  }

  async listProductionCompanies(page: number, sort: SortOptions) {
    return await listProductionCompanies({
      query: {
        pageSize: 20,
        startPage: page,
        sort: sort.order,
        sortBy: sort.field,
      },
    });
  }

  async describeNetwork(id: number) {
    return await describeNetwork({
      path: {
        networkId: id,
      },
    });
  }

  async listNetworks(page: number, sort: SortOptions) {
    return await listNetworks({
      query: {
        pageSize: 20,
        startPage: page,
        sort: sort.order,
        sortBy: sort.field,
      },
    });
  }

  async listMoviesForProductionCompany(id: number) {
    return await listProductionCompanyMovies({
      path: {
        productionCompanyId: id,
      },
    });
  }

  async listTvSeriesCast(id: number) {
    return await listTvSeriesCast({
      path: {
        tvSeriesId: id,
      },
    });
  }

  async listTvSeriesRecommendations(id: number) {
    return await listTvSeriesRecommendations({
      path: {
        tvSeriesId: id,
      },
    });
  }

  async listTvSeasonCast(id: number, seasonNumber: number) {
    return await listTvSeasonCast({
      path: {
        tvSeriesId: id,
        seasonNumber: seasonNumber,
      },
    });
  }

  async listTvSeriesCrew(id: number) {
    return await listTvSeriesCrew({
      path: {
        tvSeriesId: id,
      },
    });
  }

  async listTvSeasonCrew(id: number, seasonNumber: number) {
    return await listTvSeasonCrew({
      path: {
        tvSeriesId: id,
        seasonNumber: seasonNumber,
      },
    });
  }

  async listTvSeriesForProductionCompany(id: number) {
    return await listProductionCompanyTvSeries({
      path: {
        productionCompanyId: id,
      },
    });
  }

  async listTvSeriesForNetwork(id: number) {
    return await listNetworkTvSeries({
      path: {
        networkId: id,
      },
    });
  }

  async getMovieLocationStatistics() {
    return await getMovieLocationStatistics({});
  }

  async getMovieReleaseStatusStatistics() {
    return await getMovieReleaseStatusStatistics({});
  }

  async getMovieReleaseYearStatistics() {
    return await getMovieReleaseYearStatistics({});
  }

  async getMovieAggregateStatistics() {
    return await getMovieAggregateStatistics({});
  }

  async getMovieRuntimeStatistics() {
    return await getMovieRuntimeStatistics({});
  }

  async getTvSeriesLocationStatistics() {
    return await getTvSeriesLocationStatistics({});
  }

  async getTvSeriesStatusStatistics() {
    return await getTvSeriesStatusStatistics({});
  }

  async getTvSeriesFirstAirYearStatistics() {
    return await getTvSeriesFirstAirYearStatistics({});
  }

  async getTvSeriesEpisodeRuntimeStatistics() {
    return await getTvSeriesEpisodeRuntimeStatistics({});
  }

  async getTvSeriesSeasonStatistics() {
    return await getTvSeriesSeasonStatistics({});
  }

  async getTvSeriesAggregateStatistics() {
    return await getTvSeriesAggregateStatistics({});
  }

  async listMetadataFetchJobs(
    page: number,
    pageSize: number,
    sort: SortOptions,
    filters?: FilterDefinition,
  ) {
    return await listMetadataFetchJobs({
      query: {
        pageSize: pageSize,
        startPage: page,
        sort: sort.order,
        sortBy: sort.field,
        filters: filters
          ? `${Buffer.from(JSON.stringify(filters)).toString("base64")}`
          : undefined,
      },
    });
  }

  async listPeople(
    page: number,
    pageSize: number,
    sort: SortOptions,
    filters?: FilterDefinition,
  ) {
    console.log(filters);

    return await listPeople({
      query: {
        pageSize: pageSize,
        startPage: page,
        sort: sort.order,
        sortBy: sort.field,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async listMovies(
    page: number,
    pageSize: number,
    sort: SortOptions,
    filters?: FilterDefinition,
  ) {
    return await listMovies({
      query: {
        pageSize: pageSize,
        startPage: page,
        sort: sort.order,
        sortBy: sort.field,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async listTvSeries(
    page: number,
    pageSize: number,
    sort: SortOptions,
    filters?: FilterDefinition,
  ) {
    return await listTvSeries({
      query: {
        pageSize: pageSize,
        startPage: page,
        sort: sort.order,
        sortBy: sort.field,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async createMetadataFetchJob(
    id: string,
    type: MetadataJobType,
    status: MetadataFetchJobStatus,
    ttl: number,
    jitter: number,
    publish: boolean,
    bypassCache: boolean,
    context: Record<string, string>,
  ) {
    return await createMetadataFetchJob({
      body: {
        id: id,
        type: type,
        status: status,
        ttl: ttl,
        jitter: jitter,
        publishNotification: publish,
        bypassCache: bypassCache,
        context: context,
      },
    });
  }

  async updateMetadataFetchJob(
    id: string,
    type: MetadataJobType,
    data: MetadatFetchJobUpdate,
    republish: boolean,
    bypassCache?: boolean,
  ) {
    await updateMetadataFetchJob({
      path: {
        entityId: id,
        entityType: type,
      },
      body: {
        job: data,
        publishNotification: republish,
        bypassCache: bypassCache || false,
      },
    });
  }

  async describeMetadataFetchJob(id: string, type: MetadataJobType) {
    return await describeMetadataFetchJob({
      path: {
        entityId: id,
        entityType: type,
      },
    });
  }

  async deleteMetadataFetchJob(id: string, type: MetadataJobType) {
    return await deleteMetadataFetchJob({
      path: {
        entityId: id,
        entityType: type,
      },
    });
  }

  async fetchJobStatistics() {
    return await getMetadataFetchJobStatistics();
  }
}

const metadataApi = new MetadataApi();
export default metadataApi;
