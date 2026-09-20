import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobApi, MetadataApi } from "@ncfritz/olympus-client";
import { CertificationsBatchHandler } from "../../../src/batch/handlers/CertificationsBatchHandler";
import { CountriesBatchHandler } from "../../../src/batch/handlers/CountriesBatchHandler";
import { GenresBatchHandler } from "../../../src/batch/handlers/GenresBatchHandler";
import { LanguagesBatchHandler } from "../../../src/batch/handlers/LanguagesBatchHandler";
import { RedriveBatchHandler } from "../../../src/batch/handlers/RedriveBatchHandler";
import type { FetchJobs } from "../../../src/fetchJobs/FetchJobs";
import type { TmdbClient } from "../../../src/tmdb/services/TmdbClient";
import type { ExecutionRegistry } from "../../../src/workflow/services/ExecutionRegistry";
import type { JobNotifier } from "../../../src/workflow/services/JobNotifier";
import {
  fakeAmqp,
  fakeJobApi,
  fakeFetchJobs,
  fakeMetadataApi,
  fakeNotifier,
  fakeStore,
  type FakeStore,
  fetchJob,
} from "../../fixtures/fakes";

type Handler = { handle(message: object): Promise<void> };

const fakeTmdb = () => ({
  listCountries: vi.fn(async () => [
    { iso_3166_1: "US", english_name: "United States", native_name: "" },
  ]),
  listLanguages: vi.fn(async () => [
    { iso_639_1: "de", english_name: "German", name: "Deutsch" },
  ]),
  getTvShowGenres: vi.fn(async () => ({
    genres: [{ id: 35, name: "Comedy" }],
  })),
  getMovieGenres: vi.fn(async () => ({ genres: [{ id: 35, name: "Comedy" }] })),
  getTvCertifications: vi.fn(async () => ({
    certifications: {
      US: [{ certification: "TV-14", order: 4, meaning: "14+" }],
    },
  })),
  getMovieCertifications: vi.fn(async () => ({
    certifications: { US: [{ certification: "R", order: 4, meaning: "17+" }] },
  })),
});

describe("batch handlers", () => {
  let store: FakeStore;
  let metadataApi: ReturnType<typeof fakeMetadataApi>;
  let jobApi: ReturnType<typeof fakeJobApi>;
  let tmdb: ReturnType<typeof fakeTmdb>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const create = <H>(Type: abstract new (...args: any[]) => H): H =>
    new (Type as unknown as new (...args: unknown[]) => H)(
      fakeAmqp() as unknown as AmqpConnection,
      jobApi as unknown as JobApi,
      metadataApi as unknown as MetadataApi,
      tmdb as unknown as TmdbClient,
      fakeFetchJobs(store) as unknown as FetchJobs,
      { add: vi.fn(), remove: vi.fn() } as unknown as ExecutionRegistry,
      fakeNotifier() as unknown as JobNotifier,
    );

  beforeEach(() => {
    store = fakeStore();
    metadataApi = fakeMetadataApi();
    jobApi = fakeJobApi();
    tmdb = fakeTmdb();
  });

  describe("reference lists", () => {
    it.each([
      [
        CountriesBatchHandler,
        "countries",
        "createCountry",
        "US",
        { id: "US", name: "United States" },
      ],
      [
        LanguagesBatchHandler,
        "languages",
        "createLanguage",
        "de",
        { id: "de", name: "German", nativeName: "Deutsch" },
      ],
    ])(
      "%o stores each entry and records it fetched",
      async (Type, jobType, create_, id, entity) => {
        await (create(Type as typeof CountriesBatchHandler) as Handler).handle({
          jobId: "j",
          jobType,
          offset: 0,
        });
        expect(metadataApi[create_]).toHaveBeenCalledWith(entity);
        expect(store.createMetadataFetchJob).toHaveBeenCalledWith(
          id,
          jobType,
          90,
          expect.any(Number),
          "fetched",
          false,
        );
      },
    );

    it("keys genres by id and type", async () => {
      await create(GenresBatchHandler).handle({
        jobId: "j",
        jobType: "genres",
        offset: 0,
      });
      expect(store.createMetadataFetchJob.mock.calls.map((c) => c[0])).toEqual([
        "35-TV",
        "35-Movie",
      ]);
    });

    it("keys certifications by country, type and rating", async () => {
      await create(CertificationsBatchHandler).handle({
        jobId: "j",
        jobType: "certifications",
        offset: 0,
      });
      expect(store.createMetadataFetchJob.mock.calls.map((c) => c[0])).toEqual([
        "US_TV_TV-14",
        "US_Movie_R",
      ]);
    });

    it("records entries the API rejects as failed", async () => {
      metadataApi.createCountry.mockRejectedValue(new Error("bad"));
      await create(CountriesBatchHandler).handle({
        jobId: "j",
        jobType: "countries",
        offset: 0,
      });
      expect(store.createMetadataFetchJob.mock.lastCall![4]).toBe("failed");
    });
  });

  describe("redrive", () => {
    it("moves the fetch jobs to the target status, bypassing cache and freshness", async () => {
      store = fakeStore([fetchJob({ id: "1", status: "failed" })]);
      jobApi.scrollMetadataFetchJobs
        .mockResolvedValueOnce({ jobs: [fetchJob({ id: "1" })], count: 1 })
        .mockResolvedValueOnce({ jobs: [], count: 1 });
      const handler = create(RedriveBatchHandler);

      await handler.handle({
        jobId: "j",
        jobType: "movies",
        offset: 0,
        status: "failed",
        targetStatus: "queued",
        republish: true,
      });

      expect(jobApi.scrollMetadataFetchJobs).toHaveBeenCalledWith(
        "movies",
        "failed",
        undefined,
      );
      expect(store.updateMetadataFetchJob).toHaveBeenCalledWith(
        "1",
        "movies",
        { status: "queued" },
        true,
        true,
      );
    });
  });
});
