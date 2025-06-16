import {
  Certification,
  Collection,
  Country,
  CreateCertificationResponse,
  CreateCollectionResponse,
  CreateCountryResponse,
  CreateGenreResponse,
  CreateKeywordResponse,
  CreateMetadataFetchJobResponse,
  CreateMovieResponse,
  CreateNetworkResponse,
  CreatePersonResponse,
  CreateProductionCompanyResponse,
  CreateTVEpisodeResponse,
  CreateTVSeasonResponse,
  CreateTVSeriesResponse,
  DescribeMetadataFetchJobResponse,
  Episode,
  Genre,
  JobStatus,
  Keyword,
  ListMetadataFetchJobsResponse,
  MetadataFetchJob,
  MetadataFetchJobStatus,
  MetadataJobType,
  Movie,
  Network,
  PartialCertification,
  PartialCountry,
  PartialEpisode,
  PartialGenre,
  PartialKeyword,
  PartialLanguage,
  PartialMetadataFetchJob,
  PartialMovie,
  PartialNetwork,
  PartialPerson,
  PartialProductionCompany,
  PartialSeason,
  PartialTVSeries,
  Person,
  ProductionCompany,
  Season,
  TVSeries,
  UpdateMetadataFetchJobResponse,
} from "@ncfritz/olympus-model";
import { PartialCollection } from "@ncfritz/olympus-model";
import moment from "moment";
import { BASE_URL, executeRequest } from "./apiBase";

const createMetadataFetchJob = async (
  id: string,
  type: string,
  ttl: number,
  jitter: number,
  status: MetadataFetchJobStatus,
  publishNotification: boolean,
  context?: Record<string, any>,
): Promise<MetadataFetchJob> => {
  const response: CreateMetadataFetchJobResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/fetchJobs`,
    method: "POST",
    successStatusCodes: [201],
    data: {
      id: id,
      type: type,
      ttl: ttl,
      jitter: jitter,
      status: status,
      lastFetchedTime:
        status === MetadataFetchJobStatus.FETCHED ? moment.utc() : undefined,
      publishNotification: publishNotification,
      context: context,
    },
  });

  return response.job;
};

const getMetadataFetchJob = async (
  id: string,
  type: string,
): Promise<MetadataFetchJob> => {
  const response: DescribeMetadataFetchJobResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/fetchJob/${encodeURIComponent(id)}/${type}`,
    method: "GET",
    successStatusCodes: [200],
  });

  return response.job;
};

const updateMetadataFetchJob = async (
  id: string,
  type: string,
  job: Partial<PartialMetadataFetchJob>,
  publishNotification: boolean,
  bypassCache: boolean,
): Promise<MetadataFetchJob> => {
  const response: UpdateMetadataFetchJobResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/fetchJob/${encodeURIComponent(id)}/${type}`,
    method: "PUT",
    data: {
      job: job,
      publishNotification: publishNotification,
      bypassCache: bypassCache,
    },
    successStatusCodes: [200],
  });

  return response.job;
};

const createCertification = async (
  certification: PartialCertification,
): Promise<Certification> => {
  const response: CreateCertificationResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/certifications`,
    method: "PUT",
    data: {
      certification: certification,
    },
    successStatusCodes: [200, 201],
  });

  return response.certification;
};

const createCollection = async (
  collection: PartialCollection,
): Promise<Collection> => {
  const response: CreateCollectionResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/collections`,
    method: "PUT",
    data: {
      collection: collection,
    },
    successStatusCodes: [200, 201],
  });

  return response.collection;
};

const createCountry = async (country: PartialCountry): Promise<Country> => {
  const response: CreateCountryResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/countries`,
    method: "PUT",
    data: {
      country: country,
    },
    successStatusCodes: [200, 201],
  });

  return response.country;
};

const createLanguage = async (language: PartialLanguage): Promise<Country> => {
  const response: CreateCountryResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/languages`,
    method: "PUT",
    data: {
      language: language,
    },
    successStatusCodes: [200, 201],
  });

  return response.country;
};

const createGenre = async (genre: PartialGenre): Promise<Genre> => {
  const response: CreateGenreResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/genres`,
    method: "PUT",
    data: {
      genre: genre,
    },
    successStatusCodes: [200, 201],
  });

  return response.genre;
};

const createKeyword = async (keyword: PartialKeyword): Promise<Keyword> => {
  const response: CreateKeywordResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/keywords`,
    method: "PUT",
    data: {
      keyword: keyword,
    },
    successStatusCodes: [200, 201],
  });

  return response.keyword;
};

const createProductionCompany = async (
  company: PartialProductionCompany,
): Promise<ProductionCompany> => {
  const response: CreateProductionCompanyResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/productionCompanies`,
    method: "PUT",
    data: {
      company: company,
    },
    successStatusCodes: [200, 201],
  });

  return response.company;
};

const createMovie = async (movie: PartialMovie): Promise<Movie> => {
  const response: CreateMovieResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/movies`,
    method: "PUT",
    data: {
      movie: movie,
    },
    successStatusCodes: [200, 201],
  });

  return response.movie;
};

const createNetwork = async (network: PartialNetwork): Promise<Network> => {
  const response: CreateNetworkResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/networks`,
    method: "PUT",
    data: {
      network: network,
    },
    successStatusCodes: [200, 201],
  });

  return response.network;
};

const createPerson = async (person: PartialPerson): Promise<Person> => {
  const response: CreatePersonResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/people`,
    method: "PUT",
    data: {
      person: person,
    },
    successStatusCodes: [200, 201],
  });

  return response.person;
};

const createTVSeries = async (series: PartialTVSeries): Promise<TVSeries> => {
  const response: CreateTVSeriesResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/tvSeries`,
    method: "PUT",
    data: {
      tvSeries: series,
    },
    successStatusCodes: [200, 201],
  });

  return response.tvSeries;
};

const createTVSeason = async (
  seriesId: number,
  season: PartialSeason,
): Promise<Season> => {
  const response: CreateTVSeasonResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/tvSeries/${seriesId}/seasons`,
    method: "PUT",
    data: {
      season: season,
    },
    successStatusCodes: [200, 201],
  });

  return response.season;
};

const createTVEpisode = async (
  seriesId: number,
  seasonNumber: number,
  episode: PartialEpisode,
): Promise<Episode> => {
  const response: CreateTVEpisodeResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/tvSeries/${seriesId}/season/${seasonNumber}/episodes`,
    method: "PUT",
    data: {
      episode: episode,
    },
    successStatusCodes: [200, 201],
  });

  return response.episode;
};

const listMetadataFetchJobs = async (
  type: MetadataJobType,
  status: JobStatus,
  page = 0,
): Promise<ListMetadataFetchJobsResponse> => {
  const filters = {
    type: [type],
    status: [status],
  };
  const encodedFilters = Buffer.from(JSON.stringify(filters)).toString(
    "base64",
  );

  return await executeRequest({
    url: `${BASE_URL}/v1/jobs/metadata?pageSize=500&startPage=${page}&sortBy=id&sort=asc&filters=${encodedFilters}`,
    method: "GET",
    successStatusCodes: [200],
  });
};

const scrollMetadataFetchJobs = async (
  type: MetadataJobType,
  status: JobStatus,
  lastSeenId?: string,
): Promise<ListMetadataFetchJobsResponse> => {
  const filters = {
    type: [type],
    status: [status],
  };
  const encodedFilters = Buffer.from(JSON.stringify(filters)).toString(
    "base64",
  );

  const queryString = ["pageSize=500", `filters=${encodedFilters}`];

  if (lastSeenId) {
    queryString.push(`lastSeenId=${lastSeenId}`);
  }

  return await executeRequest({
    url: `${BASE_URL}/v1/jobs/metadata/scroll?${queryString.join("&")}`,
    method: "GET",
    successStatusCodes: [200],
  });
};

const metadataApi = {
  createCertification: createCertification,
  createCollection: createCollection,
  createCountry: createCountry,
  createGenre: createGenre,
  createKeyword: createKeyword,
  createLanguage: createLanguage,
  createNetwork: createNetwork,
  createMovie: createMovie,
  createPerson: createPerson,
  createTVSeries: createTVSeries,
  createTVSeason: createTVSeason,
  createTVEpisode: createTVEpisode,
  createProductionCompany: createProductionCompany,
  createMetadataFetchJob: createMetadataFetchJob,
  getMetadataFetchJob: getMetadataFetchJob,
  listMetadataFetchJobs: listMetadataFetchJobs,
  scrollMetadataFetchJobs: scrollMetadataFetchJobs,
  updateMetadataFetchJob: updateMetadataFetchJob,
};

export default metadataApi;
