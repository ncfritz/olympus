import moment from "moment";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MetadataApi } from "../../../src/api/MetadataApi";
import { EntityHandler } from "../../../src/entities/handlers/EntityHandler";
import { MovieMetadataHandler } from "../../../src/entities/handlers/MovieMetadataHandler";
import { ProductionCompanyMetadataHandler } from "../../../src/entities/handlers/ProductionCompanyMetadataHandler";
import { PersonMetadataHandler } from "../../../src/entities/handlers/PersonMetadataHandler";
import { TvEpisodeMetadataHandler } from "../../../src/entities/handlers/TvEpisodeMetadataHandler";
import { TvSeasonMetadataHandler } from "../../../src/entities/handlers/TvSeasonMetadataHandler";
import { TvSeriesMetadataHandler } from "../../../src/entities/handlers/TvSeriesMetadataHandler";
import type { FetchJobs } from "../../../src/fetchJobs/FetchJobs";
import type { TmdbClient } from "../../../src/tmdb/services/TmdbClient";
import {
  fakeFetchJobs,
  fakeMetadataApi,
  fakeStore,
  type FakeStore,
  fetchJob,
  PAST,
} from "../../fixtures/fakes";
import * as tmdb from "../../fixtures/tmdb";

type Handler = { handle(msg: object): Promise<void> };

const fakeTmdb = () => ({
  getMovieDetails: vi.fn(async () => tmdb.movieDetails()),
  getMovieRecommendations: vi.fn(async () => tmdb.recommendations()),
  getTvSeriesDetails: vi.fn(async () => tmdb.tvSeriesDetails()),
  getTvSeriesRecommendation: vi.fn(async () => tmdb.recommendations()),
  getTvSeasonDetails: vi.fn(async () => tmdb.tvSeasonDetails()),
  getTvEpisodeDetails: vi.fn(async () => tmdb.tvEpisodeDetails()),
  getPersonDetails: vi.fn(async () => tmdb.personDetails()),
  getProductionCompanyDetails: vi.fn(async () => tmdb.companyDetails()),
  getProductionCompanyAlternativeNames: vi.fn(async () =>
    tmdb.alternativeNames(),
  ),
  getProductionCompanyImages: vi.fn(async () => tmdb.logos()),
  getNetworkAlternativeNames: vi.fn(async () => ({ results: [] })),
});

describe("entity handlers", () => {
  let store: FakeStore;
  let tmdbClient: ReturnType<typeof fakeTmdb>;
  let metadataApi: ReturnType<typeof fakeMetadataApi>;

  const create = <H>(
    Type: new (f: FetchJobs, t: TmdbClient, m: MetadataApi) => H,
  ): H =>
    new Type(
      fakeFetchJobs(store) as unknown as FetchJobs,
      tmdbClient as unknown as TmdbClient,
      metadataApi as unknown as MetadataApi,
    );

  /** The fetch job's final update. */
  const outcome = () =>
    store.updateMetadataFetchJob.mock.lastCall![2] as Record<string, unknown>;

  beforeAll(() => {
    // No pause between fetches.
    vi.spyOn(
      EntityHandler.prototype as unknown as { sleep(): Promise<void> },
      "sleep",
    ).mockResolvedValue(undefined);
  });

  beforeEach(() => {
    store = fakeStore([
      fetchJob({ id: "603", type: "movies" }),
      fetchJob({ id: "6384", type: "people" }),
      fetchJob({ id: "2316", type: "tv_series" }),
      fetchJob({ id: "2316-1", type: "tv_seasons" }),
      fetchJob({
        id: "2316-1-1",
        type: "tv_episodes",
        context: { seasonId: "3812" },
      } as never),
    ]);
    tmdbClient = fakeTmdb();
    metadataApi = fakeMetadataApi();
  });

  describe("fetching", () => {
    let handler: Handler;
    beforeEach(() => (handler = create(MovieMetadataHandler)));

    it("stores the entity and schedules its next refresh", async () => {
      await handler.handle({ entityId: "603", entityType: "movies" });

      expect(store.updateMetadataFetchJob.mock.calls[0].slice(0, 4)).toEqual([
        "603",
        "movies",
        { status: "fetching" },
        false,
      ]);
      expect(metadataApi.createMovie).toHaveBeenCalledWith(
        expect.objectContaining({ id: 603, title: "The Matrix" }),
      );
      expect(outcome()).toMatchObject({
        status: "fetched",
        ttl: expect.any(Number),
        jitter: expect.any(Number),
        lastFetchedTime: expect.any(String),
      });
    });

    it("skips entities without a fetch job", async () => {
      await handler.handle({ entityId: "999", entityType: "movies" });
      expect(tmdbClient.getMovieDetails).not.toHaveBeenCalled();
      expect(store.updateMetadataFetchJob).not.toHaveBeenCalled();
    });

    it.each(["fetched", "failed", "invalidated", "cancelled"])(
      "skips %s fetch jobs",
      async (status) => {
        store = fakeStore([fetchJob({ status: status as never })]);
        handler = create(MovieMetadataHandler);
        await handler.handle({ entityId: "603", entityType: "movies" });
        expect(tmdbClient.getMovieDetails).not.toHaveBeenCalled();
      },
    );

    it("records TMDB's not found", async () => {
      tmdbClient.getMovieDetails.mockRejectedValue({
        status_code: 34,
        status_message: "The resource you requested could not be found.",
      });
      await handler.handle({ entityId: "603", entityType: "movies" });
      expect(outcome()).toMatchObject({ status: "not_found" });
      expect(metadataApi.createMovie).not.toHaveBeenCalled();
    });

    it("records other failures", async () => {
      metadataApi.createMovie.mockRejectedValue(new Error("API down"));
      await handler.handle({ entityId: "603", entityType: "movies" });
      expect(outcome()).toMatchObject({ status: "failed" });
    });

    it("reads the cache unless the message bypasses it", async () => {
      await handler.handle({
        entityId: "603",
        entityType: "movies",
        bypassCache: true,
      });
      expect(store.getMetadataFetchJob).toHaveBeenCalledWith(
        "603",
        "movies",
        true,
      );
    });
  });

  describe("production companies", () => {
    it("stores the company with its own alternative names", async () => {
      store = fakeStore([fetchJob({ id: "79", type: "production_companies" })]);
      await create(ProductionCompanyMetadataHandler).handle({
        entityId: "79",
        entityType: "production_companies",
      });

      expect(
        tmdbClient.getProductionCompanyAlternativeNames,
      ).toHaveBeenCalledWith(79);
      expect(tmdbClient.getNetworkAlternativeNames).not.toHaveBeenCalled();
      expect(metadataApi.createProductionCompany).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 79,
          alternativeNames: [{ name: "NBC", type: "" }],
        }),
      );
    });
  });

  describe("TV series", () => {
    it("queues a fetch of each season that isn't fresh", async () => {
      store = fakeStore([
        fetchJob({ id: "2316", type: "tv_series", ttl: 30 }),
        fetchJob({
          id: "2316-1",
          type: "tv_seasons",
          status: "fetched",
          lastFetchedTime: moment.utc().toISOString(),
        }),
      ]);
      await create(TvSeriesMetadataHandler).handle({
        entityId: "2316",
        entityType: "tv_series",
      });

      expect(metadataApi.createTVSeries).toHaveBeenCalledOnce();
      expect(store.createMetadataFetchJob.mock.calls).toEqual([
        [
          "2316-0",
          "tv_seasons",
          7,
          expect.any(Number),
          "queued",
          true,
          { seasons: 3 },
        ],
        [
          "2316-2",
          "tv_seasons",
          7,
          expect.any(Number),
          "queued",
          true,
          { seasons: 3 },
        ],
      ]);
      // Ended, last aired long ago
      expect(outcome().ttl).toBeGreaterThanOrEqual(60);
    });
  });

  describe("TV seasons", () => {
    it("stores the season and queues a fetch of each episode", async () => {
      store = fakeStore([fetchJob({ id: "2316-1", type: "tv_seasons" })]);
      await create(TvSeasonMetadataHandler).handle({
        entityId: "2316-1",
        entityType: "tv_seasons",
      });

      expect(tmdbClient.getTvSeasonDetails).toHaveBeenCalledWith(
        { tvShowID: 2316, seasonNumber: 1 },
        ["external_ids", "images", "aggregate_credits", "videos"],
      );
      expect(metadataApi.createTVSeason).toHaveBeenCalledWith(
        2316,
        expect.objectContaining({ id: 3812 }),
      );
      expect(
        store.createMetadataFetchJob.mock.calls.map((call) => [
          call[0],
          call[6],
        ]),
      ).toEqual([
        ["2316-1-1", { seasonId: 3812 }],
        ["2316-1-2", { seasonId: 3812 }],
      ]);
    });
  });

  describe("TV episodes", () => {
    it("stores the episode in its season", async () => {
      await create(TvEpisodeMetadataHandler).handle({
        entityId: "2316-1-1",
        entityType: "tv_episodes",
      });

      expect(tmdbClient.getTvEpisodeDetails).toHaveBeenCalledWith(
        { tvShowID: 2316, seasonNumber: 1, episodeNumber: 1 },
        ["external_ids", "images", "credits", "videos"],
      );
      expect(metadataApi.createTVEpisode).toHaveBeenCalledWith(
        2316,
        1,
        expect.objectContaining({ id: 9001, seasonId: 3812 }),
      );
    });
  });

  describe("refresh policies", () => {
    type Policy = { getTtl(m: object, c?: object): number };
    const ttl = (handler: unknown, metadata: object, context?: object) =>
      (handler as Policy).getTtl(metadata, context);
    const daysAgo = (days: number) =>
      moment.utc().subtract(days, "days").toISOString();

    it.each([
      [-10, 7],
      [30, 30],
      [200, 90],
      [1000, 180],
    ])("movies released %i days ago: %i days", (age, days) => {
      expect(
        ttl(create(MovieMetadataHandler), { releaseDate: daysAgo(age) }),
      ).toBe(days);
    });

    it("movies without a release date: 14 to 180 days", () => {
      const days = ttl(create(MovieMetadataHandler), {});
      expect(days).toBeGreaterThanOrEqual(14);
      expect(days).toBeLessThan(180);
    });

    it.each([
      [{ lastAirDate: daysAgo(-3) }, 1],
      [{ lastAirDate: daysAgo(10) }, 3],
      [{ lastAirDate: daysAgo(100), inProduction: true }, 7],
    ])("TV series %o: %i days", (series, days) => {
      expect(ttl(create(TvSeriesMetadataHandler), series)).toBe(days);
    });

    it.each([
      [-1, 3],
      [3, 5],
    ])(
      "TV seasons whose last episode aired %i days ago: %i days",
      (age, days) => {
        expect(
          ttl(
            create(TvSeasonMetadataHandler),
            {},
            {
              lastEpisodeAirDate: moment.utc(daysAgo(age)),
            },
          ),
        ).toBe(days);
      },
    );

    it("people: 60+ days once deceased, otherwise 7 to 14", () => {
      const handler = create(PersonMetadataHandler);
      expect(ttl(handler, { deathday: PAST })).toBeGreaterThanOrEqual(60);
      const living = ttl(handler, {});
      expect(living).toBeGreaterThanOrEqual(7);
      expect(living).toBeLessThan(14);
    });
  });
});
