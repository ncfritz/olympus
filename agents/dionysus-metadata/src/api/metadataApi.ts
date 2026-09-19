import {
  Certification,
  client,
  Country,
  createCertification,
  createCollection,
  createCountry,
  createGenre,
  createKeyword,
  createLanguage,
  createMetadataFetchJob,
  createMovie,
  createNetwork,
  createPerson,
  CreatePersonResponse,
  createProductionCompany,
  CreateTvEpisodeResponse,
  CreateTvSeasonResponse,
  createTvSeries,
  createTvSeriesEpisode,
  CreateTvSeriesResponse,
  createTvSeriesSeason,
  describeMetadataFetchJob,
  Genre,
  type JobStatus,
  Keyword,
  Language,
  ListMetadataFetchJobsResponse,
  MetadataFetchJob,
  MetadataFetchJobStatus,
  type MetadataJobType,
  type MetadatFetchJobUpdate,
  type Network,
  type PartialCertification,
  type PartialCollection,
  type PartialCountry,
  type PartialEpisode,
  type PartialGenre,
  type PartialKeyword,
  type PartialLanguage,
  type PartialMovie,
  type PartialNetwork,
  type PartialPerson,
  type PartialProductionCompany,
  type PartialSeason,
  type PartialTvSeries,
  scrollMetadataFetchJobs,
  SparseMovie,
  SparseProductionCompany,
  updateMetadataFetchJob,
} from "@ncfritz/olympus-sdk/dionysus";
import moment from "moment";
import { BASE_URL } from "./apiBase";
import { ExecuteWithMetrics } from "./executeDecorators";

class MetadataApi {
  constructor() {
    client.setConfig({
      baseURL: BASE_URL,
      throwOnError: true,
    });
  }

  async createMetadataFetchJob(
    id: string,
    type: MetadataJobType,
    ttl: number,
    jitter: number,
    status: MetadataFetchJobStatus,
    publishNotification: boolean,
    context?: Record<string, unknown>,
  ): Promise<MetadataFetchJob> {
    const response = await createMetadataFetchJob({
      body: {
        id: id,
        type: type,
        ttl: ttl,
        jitter: jitter,
        status: status,
        lastFetchedTime:
          status === "fetched" ? moment.utc().toISOString() : undefined,
        publishNotification: publishNotification,
        context: context,
      },
    });

    return response.data!.job;
  }

  @ExecuteWithMetrics("Dionysus.DescribeMetadataFetchJob")
  async getMetadataFetchJob(
    id: string,
    type: MetadataJobType,
  ): Promise<MetadataFetchJob> {
    const response = await describeMetadataFetchJob({
      path: {
        entityId: id,
        entityType: type,
      },
    });

    return response.data!.job;
  }

  @ExecuteWithMetrics("Dionysus.UpdateMetadataFetchJob")
  async updateMetadataFetchJob(
    id: string,
    type: MetadataJobType,
    job: MetadatFetchJobUpdate,
    publishNotification: boolean,
    bypassCache: boolean,
  ): Promise<MetadataFetchJob> {
    const response = await updateMetadataFetchJob({
      path: {
        entityId: id,
        entityType: type,
      },
      body: {
        job: job,
        publishNotification: publishNotification,
        bypassCache: bypassCache,
      },
    });

    return response.data!.job;
  }

  @ExecuteWithMetrics("Dionysus.ScrollMetadataFetchJobs")
  async scrollMetadataFetchJobs(
    type: MetadataJobType,
    status: JobStatus,
    lastSeenId?: string,
  ): Promise<ListMetadataFetchJobsResponse> {
    const filters = {
      type: [type],
      status: [status],
    };
    const encodedFilters = Buffer.from(JSON.stringify(filters)).toString(
      "base64",
    );

    const response = await scrollMetadataFetchJobs({
      query: {
        lastSeenId: lastSeenId,
        pageSize: 500,
        filters: encodedFilters,
      },
    });

    return response.data!;
  }

  @ExecuteWithMetrics("Dionysus.CreateCertification")
  async createCertification(
    certification: PartialCertification,
  ): Promise<Certification> {
    const response = await createCertification({
      body: {
        certification: certification,
      },
    });

    return response.data!.certification;
  }

  @ExecuteWithMetrics("Dionysus.CreateCollection")
  async createCollection(collection: PartialCollection): Promise<number> {
    const response = await createCollection({
      body: {
        collection: collection,
      },
    });

    return response.data!.id;
  }

  @ExecuteWithMetrics("Dionysus.CreateCountry")
  async createCountry(country: PartialCountry): Promise<Country> {
    const response = await createCountry({
      body: {
        country: country,
      },
    });

    return response.data!.country;
  }

  @ExecuteWithMetrics("Dionysus.CreateLanguage")
  async createLanguage(language: PartialLanguage): Promise<Language> {
    const response = await createLanguage({
      body: {
        language: language,
      },
    });

    return response.data!.language;
  }

  @ExecuteWithMetrics("Dionysus.CreateGenre")
  async createGenre(genre: PartialGenre): Promise<Genre> {
    const response = await createGenre({
      body: {
        genre: genre,
      },
    });

    return response.data!.genre;
  }

  @ExecuteWithMetrics("Dionysus.CreateKeyword")
  async createKeyword(keyword: PartialKeyword): Promise<Keyword> {
    const response = await createKeyword({
      body: {
        keyword: keyword,
      },
    });

    return response.data!.keyword;
  }

  @ExecuteWithMetrics("Dionysus.CreateMovie")
  async createMovie(movie: PartialMovie): Promise<SparseMovie> {
    const response = await createMovie({
      body: {
        movie: movie,
      },
    });

    return response.data!.movie;
  }

  @ExecuteWithMetrics("Dionysus.CreateNetwork")
  async createNetwork(network: PartialNetwork): Promise<Network> {
    const response = await createNetwork({
      body: {
        network: network,
      },
    });

    return response.data!.network;
  }

  @ExecuteWithMetrics("Dionysus.CreatePerson")
  async createPerson(person: PartialPerson): Promise<CreatePersonResponse> {
    const response = await createPerson({
      body: {
        person: person,
      },
    });

    return response.data!;
  }

  @ExecuteWithMetrics("Dionysus.CreateProductionCompany")
  async createProductionCompany(
    company: PartialProductionCompany,
  ): Promise<SparseProductionCompany> {
    const response = await createProductionCompany({
      body: {
        company: company,
      },
    });

    return response.data!.company;
  }

  @ExecuteWithMetrics("Dionysus.CreateTvSeries")
  async createTVSeries(
    series: PartialTvSeries,
  ): Promise<CreateTvSeriesResponse> {
    const response = await createTvSeries({
      body: {
        tvSeries: series,
      },
    });

    return response.data!;
  }

  @ExecuteWithMetrics("Dionysus.CreateTvSeason")
  async createTVSeason(
    seriesId: number,
    season: PartialSeason,
  ): Promise<CreateTvSeasonResponse> {
    const response = await createTvSeriesSeason({
      path: {
        seriesId: seriesId,
      },
      body: {
        season: season,
      },
    });

    return response.data!;
  }

  @ExecuteWithMetrics("Dionysus.CreateTvEpisode")
  async createTVEpisode(
    seriesId: number,
    seasonNumber: number,
    episode: PartialEpisode,
  ): Promise<CreateTvEpisodeResponse> {
    const response = await createTvSeriesEpisode({
      path: {
        seriesId: seriesId,
        seasonNumber: seasonNumber,
      },
      body: {
        episode: episode,
      },
    });

    return response.data!;
  }
}

const metadataApi = new MetadataApi();
export default metadataApi;
