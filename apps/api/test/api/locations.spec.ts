/**
 * Every create operation: the Location header names the created resource's
 * GET route (utils/location), or is absent when there is no such route.
 * Behind nginx the X-Forwarded-Prefix is prepended.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ASSET_ID,
  CATEGORY_ID,
  CHANNEL_ID,
  graphQlChannel,
  graphQlChannelCategory,
  graphQlContentAsset,
  graphQlContentTag,
  graphQlIngestStep,
  graphQlIngestWorkflow,
  INGEST_ID,
} from "../fixtures/content";
import {
  aggregate,
  BATCH_JOB_ID,
  graphQlBatchJob,
  graphQlMetadataFetchJob,
  graphQlWorkflow,
  graphQlWorkflowStep,
  STEP_ID,
  WORKFLOW_ID,
} from "../fixtures/dionysus";
import {
  EXECUTION_ID,
  graphQlDownload,
  graphQlFavorite,
  graphQlMediaAsset,
  graphQlMediaWorkflow,
  graphQlMediaWorkflowStep,
  graphQlSearchConfiguration,
  graphQlSearchExecution,
  graphQlSearchResult,
  MEDIA_STEP_ID,
  MEDIA_WORKFLOW_ID,
  MOVIE_ID,
  RESULT_ID,
} from "../fixtures/media";
import {
  languageRow,
  networkRow,
  productionCompanyRow,
} from "../fixtures/metadata";
import { graphQlMeeting, graphQlNote } from "../fixtures/minerva";
import { controllers } from "../support/controllers";
import { createTestApp, type TestApp } from "../support/testApp";

type Row = Record<string, unknown>;
type Case = {
  name: string;
  method: "post" | "put";
  url: string;
  body?: Row;
  graphql: Record<string, Row>;
  /** Expected Location without the /v1 prefix; undefined when not set. */
  location?: string;
};

const D = "/v1/dionysus";
const noteId = graphQlNote().id;
const configExists = {
  dionysus_media_asset_search_configuration_by_pk: {
    assetType: "movie",
    mediaId: MOVIE_ID,
  },
};
const resultExists = {
  dionysus_media_asset_search_result_by_pk: {
    assetType: "movie",
    mediaId: MOVIE_ID,
    id: RESULT_ID,
  },
};
const channel = {
  name: "Beaches",
  description: "Sand",
  bcCompliant: true,
  categoryId: CATEGORY_ID,
  filterInput: "beach",
  filterDefinition: { type: "eq", name: "name", value: "beach" },
};

const CASES: Case[] = [
  // Minerva
  {
    name: "CreateNote",
    method: "post",
    url: "/v1/minerva/notes",
    body: { note: { value: "x" } },
    graphql: { CreateNote: { insert_minerva_notes_one: graphQlNote() } },
    location: `/minerva/note/${noteId}`,
  },
  {
    name: "CreateChildNote",
    method: "post",
    url: "/v1/minerva/note/parent-1/children",
    body: { note: { value: "x" } },
    graphql: { CreateNote: { insert_minerva_notes_one: graphQlNote() } },
    location: `/minerva/note/${noteId}`,
  },
  {
    name: "CreateCalendarItem",
    method: "post",
    url: "/v1/minerva/meetings",
    body: { item: { id: "meeting-1", organizer: {}, attendees: [] } },
    graphql: {
      CreateMeeting: { insert_minerva_meetings_one: graphQlMeeting() },
    },
    location: `/minerva/meeting/${graphQlMeeting().id}`,
  },
  // Dionysus content
  {
    name: "CreateContentAsset",
    method: "post",
    url: `${D}/content/assets`,
    body: { asset: { id: ASSET_ID } },
    graphql: {
      CreateContentAsset: {
        insert_dionysus_content_assets_one: graphQlContentAsset(),
      },
    },
    location: `/dionysus/content/asset/${ASSET_ID}`,
  },
  {
    name: "CreateContentAssetChannel",
    method: "post",
    url: `${D}/content/channels`,
    body: { channel },
    graphql: {
      ListContentAssetChannelCandidates: {
        dionysus_content_assets: [],
        dionysus_content_assets_aggregate: aggregate(0),
      },
      CreateContentAssetChannel: {
        insert_dionysus_content_asset_channel_one: graphQlChannel(),
      },
    },
    location: `/dionysus/content/channel/${CHANNEL_ID}`,
  },
  {
    name: "CreateContentAssetChannelCategory",
    method: "post",
    url: `${D}/content/channels/categories`,
    body: { category: { name: "Travel" } },
    graphql: {
      CreateContentAssetChannelCategory: {
        insert_dionysus_content_asset_channel_category_one:
          graphQlChannelCategory(),
      },
    },
    location: `/dionysus/content/channel/category/${CATEGORY_ID}`,
  },
  {
    name: "CreateContentAssetTag",
    method: "post",
    url: `${D}/content/assetTags`,
    body: { tag: { name: "beach", type: "user" } },
    graphql: {
      CreateTag: { insert_dionysus_content_tags_one: graphQlContentTag() },
    },
  },
  {
    name: "CreateContentIngestionWorkflow",
    method: "post",
    url: `${D}/content/workflows`,
    body: { workflow: { source: "a.mp4", sourceType: "remote" } },
    graphql: {
      CreateContentIngestionWorkflow: {
        insert_dionysus_content_asset_ingest_workflows_one:
          graphQlIngestWorkflow(),
      },
    },
    location: `/dionysus/content/workflow/${INGEST_ID}`,
  },
  {
    name: "CreateContentIngestionWorkflowStep",
    method: "post",
    url: `${D}/content/workflow/${INGEST_ID}/steps`,
    body: { step: { type: "transcode" } },
    graphql: {
      GetParentContentIngestionWorkflow: {
        dionysus_content_asset_ingest_workflows_by_pk: { id: INGEST_ID },
      },
      CreateContentIngestionWorkflowStep: {
        insert_dionysus_content_asset_ingest_workflow_steps_one:
          graphQlIngestStep(),
      },
    },
  },
  // Dionysus jobs
  {
    name: "CreateBatchJob",
    method: "post",
    url: `${D}/jobs/batch`,
    body: { type: "movies", publishNotification: false },
    graphql: {
      CreateBatchJob: { insert_dionysus_bulk_load_jobs_one: graphQlBatchJob() },
    },
    location: `/dionysus/job/batch/${BATCH_JOB_ID}`,
  },
  {
    name: "CreateRedriveJob",
    method: "post",
    url: `${D}/jobs/batch/redrive`,
    body: { metadataType: "movies", status: "failed", targetStatus: "queued" },
    graphql: {
      CreateBatchJob: { insert_dionysus_bulk_load_jobs_one: graphQlBatchJob() },
    },
    location: `/dionysus/job/batch/${BATCH_JOB_ID}`,
  },
  {
    name: "CreateMetadataFetchJob",
    method: "post",
    url: `${D}/metadata/fetchJobs`,
    body: { id: "603", type: "movies", publishNotification: false },
    graphql: {
      CreateMetadataFetchJob: {
        insert_dionysus_metadata_fetch_status_one: graphQlMetadataFetchJob(),
      },
    },
    location: "/dionysus/metadata/fetchJob/603/movies",
  },
  // Dionysus media
  {
    name: "CreateMediaAsset",
    method: "post",
    url: `${D}/media/assets`,
    body: { asset: { type: "movie", mediaId: MOVIE_ID } },
    graphql: {
      CreateMediaAsset: {
        insert_dionysus_media_asset_one: graphQlMediaAsset(),
      },
    },
  },
  {
    name: "CreateMediaAssetSearchConfiguration",
    method: "post",
    url: `${D}/media/searchConfigurations`,
    body: {
      searchConfiguration: {
        type: "movie",
        mediaId: MOVIE_ID,
        backoff: 60,
        jitter: 30,
        enabled: true,
        status: "ok",
      },
    },
    graphql: {
      VerifyMedia: { dionysus_movies_by_pk: { id: MOVIE_ID, asset: null } },
      CreateMediaAssetSearchConfiguration: {
        insert_dionysus_media_asset_search_configuration_one:
          graphQlSearchConfiguration(),
      },
    },
    location: `/dionysus/media/searchConfiguration/movie/${MOVIE_ID}`,
  },
  {
    name: "CreateMediaAssetSearchExecution",
    method: "post",
    url: `${D}/media/searchConfiguration/movie/${MOVIE_ID}/executions`,
    body: {},
    graphql: {
      VerifyMediaAssetSearchConfiguration: configExists,
      CreateMediaAssetSearchExecution: {
        insert_dionysus_media_asset_search_execution_one:
          graphQlSearchExecution(),
      },
    },
    location: `/dionysus/media/searchConfiguration/movie/${MOVIE_ID}/execution/${EXECUTION_ID}`,
  },
  {
    name: "CreateMediaAssetSearchResult",
    method: "post",
    url: `${D}/media/searchConfiguration/movie/${MOVIE_ID}/results`,
    body: { searchResult: { id: RESULT_ID } },
    graphql: {
      VerifyMediaAssetSearchConfiguration: configExists,
      CreateMediaAssetSearchResult: {
        insert_dionysus_media_asset_search_result_one: graphQlSearchResult(),
      },
    },
    location: `/dionysus/media/searchConfiguration/movie/${MOVIE_ID}/result/${RESULT_ID}`,
  },
  {
    name: "CreateMediaAssetDownload",
    method: "post",
    url: `${D}/media/searchConfiguration/movie/${MOVIE_ID}/result/${RESULT_ID}/download`,
    graphql: {
      VerifyMediaAssetSearchResult: resultExists,
      CreateMediaAssetDownload: {
        insert_dionysus_media_asset_download_one: graphQlDownload(),
        update_dionysus_media_asset_search_result_by_pk: {
          status: "download_requested",
        },
      },
    },
  },
  {
    name: "CreateMediaAssetWorkflow",
    method: "post",
    url: `${D}/media/searchConfiguration/movie/${MOVIE_ID}/workflow/${RESULT_ID}/workflow`,
    graphql: {
      VerifyMediaAssetSearchResult: resultExists,
      CreateMediaAssetWorkflow: {
        insert_dionysus_media_asset_download_one: { status: "pending" },
        insert_dionysus_media_asset_workflow_one: graphQlMediaWorkflow(),
        update_dionysus_media_asset_search_result_by_pk: {
          status: "download_requested",
        },
      },
    },
    location: `/dionysus/media/workflow/${MEDIA_WORKFLOW_ID}`,
  },
  {
    name: "CreateMediaAssetWorkflowStep",
    method: "post",
    url: `${D}/media/workflow/${MEDIA_WORKFLOW_ID}/steps`,
    body: { step: { type: "transcode" } },
    graphql: {
      GetParentMediaAssetWorkflow: {
        dionysus_media_asset_workflow_by_pk: {
          id: MEDIA_WORKFLOW_ID,
          type: "movie",
          mediaId: MOVIE_ID,
        },
      },
      CreateMediaAssetWorkflowStep: {
        insert_dionysus_media_asset_workflow_step_one:
          graphQlMediaWorkflowStep(),
      },
    },
    location: `/dionysus/media/workflow/${MEDIA_WORKFLOW_ID}/step/${MEDIA_STEP_ID}`,
  },
  {
    name: "CreateMediaAssetWorkflowSubStep",
    method: "post",
    url: `${D}/media/workflow/${MEDIA_WORKFLOW_ID}/step/${MEDIA_STEP_ID}/subSteps`,
    body: { step: { type: "sample_0" } },
    graphql: {
      GetParentMediaAssetWorkflowStep: {
        dionysus_media_asset_workflow_step_by_pk: {
          id: MEDIA_STEP_ID,
          type: "verify_transcode",
          status: "running",
          assetType: "movie",
          mediaId: MOVIE_ID,
          progress: 0,
        },
      },
      CreateMediaAssetWorkflowSubStep: {
        insert_dionysus_media_asset_workflow_step_one: {
          ...graphQlMediaWorkflowStep({ id: "sub-1" }),
          type: "sample_0",
        },
      },
    },
    location: `/dionysus/media/workflow/${MEDIA_WORKFLOW_ID}/step/sub-1`,
  },
  {
    name: "CreateMediaFavorite",
    method: "post",
    url: `${D}/media/favorite/movie/${MOVIE_ID}`,
    graphql: {
      GetMediaIdForAsset: { dionysus_media_id_one: { id: MOVIE_ID } },
      CreateMediaFavorite: {
        insert_dionysus_media_favorite_one: graphQlFavorite(),
      },
    },
  },
  // Dionysus metadata (upserts)
  {
    name: "CreateCertification",
    method: "put",
    url: `${D}/metadata/certifications`,
    body: {
      certification: { country: "US", certification: "R", type: "movie" },
    },
    graphql: {
      CreateCertification: {
        insert_dionysus_certifications_one: {
          country: "US",
          certification: "R",
          type: "movie",
        },
      },
    },
  },
  {
    name: "CreateCountry",
    method: "put",
    url: `${D}/metadata/countries`,
    body: { country: { id: "US", name: "United States" } },
    graphql: {
      CreateCountry: {
        insert_dionysus_countries_one: { id: "US", name: "United States" },
      },
    },
  },
  {
    name: "CreateGenre",
    method: "put",
    url: `${D}/metadata/genres`,
    body: { genre: { id: 28, name: "Action" } },
    graphql: {
      CreateGenre: { insert_dionysus_genres_one: { id: 28, name: "Action" } },
    },
  },
  {
    name: "CreateKeyword",
    method: "put",
    url: `${D}/metadata/keywords`,
    body: { keyword: { id: 1, value: "hacker" } },
    graphql: {
      CreateKeyword: {
        insert_dionysus_keywords_one: { id: 1, value: "hacker" },
      },
    },
  },
  {
    name: "CreateLanguage",
    method: "put",
    url: `${D}/metadata/languages`,
    body: { language: { id: "en", name: "English", nativeName: "English" } },
    graphql: {
      CreateLanguage: { insert_dionysus_languages_one: languageRow() },
    },
  },
  {
    name: "CreateCollection",
    method: "put",
    url: `${D}/metadata/collections`,
    body: {
      collection: {
        id: 2344,
        name: "The Matrix Collection",
        images: [],
        parts: [],
      },
    },
    graphql: {
      CreateCollection: {
        insert_dionysus_collections_one: {
          id: 2344,
          name: "The Matrix Collection",
          images: [],
          parts: [],
        },
      },
    },
    location: "/dionysus/metadata/collection/2344",
  },
  {
    name: "CreateMovie",
    method: "put",
    url: `${D}/metadata/movies`,
    body: { movie: { id: 603 } },
    graphql: { CreateMovie: { insert_dionysus_movies_one: { id: 603 } } },
    location: "/dionysus/metadata/movie/603",
  },
  {
    name: "CreateNetwork",
    method: "put",
    url: `${D}/metadata/networks`,
    body: {
      network: { id: 49, name: "HBO", alternativeNames: [], images: [] },
    },
    graphql: { CreateNetwork: { insert_dionysus_networks_one: networkRow() } },
    location: "/dionysus/metadata/network/49",
  },
  {
    name: "CreatePerson",
    method: "put",
    url: `${D}/metadata/people`,
    body: {
      person: {
        id: 6384,
        name: "Keanu Reeves",
        externalIds: [],
        alsoKnownAs: [],
        images: [],
      },
    },
    graphql: {
      CreatePerson: {
        insert_dionysus_people_one: { id: 6384, name: "Keanu Reeves" },
      },
    },
    location: "/dionysus/metadata/person/6384",
  },
  {
    name: "CreateProductionCompany",
    method: "put",
    url: `${D}/metadata/productionCompanies`,
    body: {
      company: { id: 1, name: "Lucasfilm", alternativeNames: [], logos: [] },
    },
    graphql: {
      CreateProductionCompany: {
        insert_dionysus_production_companies_one: productionCompanyRow(),
      },
    },
    location: "/dionysus/metadata/productionCompany/1",
  },
  {
    name: "CreateTVSeries",
    method: "put",
    url: `${D}/metadata/tvSeries`,
    body: { tvSeries: { id: 1399, cast: [], crew: [] } },
    graphql: {
      CreateTVSeries: {
        insert_dionysus_tv_series_one: { id: 1399 },
        insert_dionysus_tv_series_cast_roles: { affected_rows: 0 },
        insert_dionysus_tv_series_crew_jobs: { affected_rows: 0 },
      },
    },
    location: "/dionysus/metadata/tvSeries/1399",
  },
  {
    name: "CreateTVSeriesSeason",
    method: "put",
    url: `${D}/metadata/tvSeries/1399/seasons`,
    body: { season: { id: 3624, seasonNumber: 1, cast: [], crew: [] } },
    graphql: {
      CreateTVSeriesSeason: {
        insert_dionysus_tv_seasons_one: {
          id: 3624,
          seasonNumber: 1,
          seriesId: 1399,
        },
        insert_dionysus_tv_season_cast_roles: { affected_rows: 0 },
        insert_dionysus_tv_season_crew_jobs: { affected_rows: 0 },
      },
    },
    location: "/dionysus/metadata/tvSeries/1399/seasons/1",
  },
  {
    name: "CreateTVSeriesEpisode",
    method: "put",
    url: `${D}/metadata/tvSeries/1399/season/1/episodes`,
    body: { episode: { id: 63056, seasonId: 3624, episodeNumber: 1 } },
    graphql: {
      CreateTVSeriesEpisode: {
        insert_dionysus_tv_episodes_one: {
          id: 63056,
          episodeNumber: 1,
          seasonId: 3624,
          seasonNumber: 1,
          seriesId: 1399,
        },
      },
    },
    location: "/dionysus/metadata/tvSeries/1399/seasons/1/episodes/1",
  },
  // Dionysus metadata workflows
  {
    name: "CreateMetadataWorkflow",
    method: "post",
    url: `${D}/workflows`,
    body: {},
    graphql: {
      CreateMetadataWorkflow: {
        insert_dionysus_metadata_workflow_one: graphQlWorkflow({ steps: [] }),
      },
    },
    location: `/dionysus/workflow/${WORKFLOW_ID}`,
  },
  {
    name: "CreateMetadataWorkflowStep",
    method: "post",
    url: `${D}/workflow/${WORKFLOW_ID}/steps`,
    body: { step: { type: "job_execution", attempt: 1, jobType: "movies" } },
    graphql: {
      GetParentMetadataWorkflow: {
        dionysus_metadata_workflow_by_pk: { id: WORKFLOW_ID },
      },
      CreateMetadataWorkflowStep: {
        insert_dionysus_metadata_workflow_step_one: graphQlWorkflowStep(),
      },
    },
    location: `/dionysus/workflow/${WORKFLOW_ID}/step/${STEP_ID}`,
  },
];

describe("Location headers of created resources", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(() => t.reset());

  const send = (c: Case, headers: Record<string, string> = {}) => {
    for (const [operation, response] of Object.entries(c.graphql)) {
      t.graphql.on(operation, response);
    }
    const req = t.http()[c.method](c.url).set(headers);
    return c.body === undefined ? req : req.send(c.body);
  };

  it.each(CASES.filter((c) => c.location).map((c) => [c.name, c] as const))(
    "%s points at the created resource",
    async (_, c) => {
      const res = await send(c);

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/v1${c.location}`);
    },
  );

  it.each(CASES.filter((c) => c.location).map((c) => [c.name, c] as const))(
    "%s adds nginx's X-Forwarded-Prefix",
    async (_, c) => {
      const res = await send(c, { "X-Forwarded-Prefix": "/api" });

      expect(res.headers.location).toBe(`/api/v1${c.location}`);
    },
  );

  it.each(CASES.filter((c) => !c.location).map((c) => [c.name, c] as const))(
    "%s has no GET route for what it creates, so sets no Location",
    async (_, c) => {
      const res = await send(c);

      expect(res.status).toBe(201);
      expect(res.headers.location).toBeUndefined();
    },
  );

  it("has a case for every operation that answers 201 with one resource", () => {
    // No GET route for a notification; an upload creates several workflows.
    const exempt = ["CreateNotification", "UploadAssets"];
    const creates = controllers
      .filter((c) => "201" in (c.routes[0]?.responses ?? {}))
      .map((c) => c.className.replace(/Controller$/, ""))
      .filter((name) => !exempt.includes(name))
      .sort();

    expect(CASES.map((c) => c.name).sort()).toEqual(creates);
  });
});
