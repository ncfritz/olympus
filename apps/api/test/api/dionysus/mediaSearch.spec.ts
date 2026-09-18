import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  EXECUTION_ID,
  graphQlMediaAsset,
  graphQlSearchConfiguration,
  graphQlSearchConfigurationListItem,
  graphQlSearchExecution,
  graphQlSearchResult,
  MOVIE_ID,
  RESULT_ID,
} from "../../fixtures/media";
import { aggregate } from "../../fixtures/dionysus";
import { base64Json } from "../../fixtures/olympus";
import { createTestApp, type TestApp } from "../../support/testApp";

const NOW = new Date("2026-09-18T12:00:00.000Z");
const CONFIG = `/v1/dionysus/media/searchConfiguration/movie/${MOVIE_ID}`;

const configExists = {
  dionysus_media_asset_search_configuration_by_pk: {
    assetType: "movie",
    mediaId: MOVIE_ID,
  },
};
const configMissing = { dionysus_media_asset_search_configuration_by_pk: null };

describe("Dionysus media search API", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(() => {
    t.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("path parameters", () => {
    it.each([
      [
        "an unknown media type",
        "/v1/dionysus/media/searchConfiguration/book/603",
      ],
      [
        "a non-numeric media ID",
        "/v1/dionysus/media/searchConfiguration/movie/abc",
      ],
    ])("rejects %s with 400", async (_, url) => {
      await t.http().get(url).expect(400);
      expect(t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("POST /v1/dionysus/media/searchConfigurations (CreateMediaAssetSearchConfiguration)", () => {
    const body = (overrides: Record<string, unknown> = {}) => ({
      searchConfiguration: {
        type: "movie",
        mediaId: MOVIE_ID,
        backoff: 60,
        jitter: 30,
        enabled: true,
        status: "ok",
        ...overrides,
      },
    });

    beforeEach(() => {
      t.graphql.on("CreateMediaAssetSearchConfiguration", {
        insert_dionysus_media_asset_search_configuration_one:
          graphQlSearchConfiguration(),
      });
    });

    it("defers a movie search by up to the jitter and returns 201", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      t.graphql.on("VerifyMedia", {
        dionysus_movies_by_pk: { id: MOVIE_ID, asset: null },
      });

      const res = await t
        .http()
        .post("/v1/dionysus/media/searchConfigurations")
        .send(body());

      expect(res.status).toBe(201);
      expect(res.body.searchConfiguration).toMatchObject({
        type: "movie",
        mediaId: MOVIE_ID,
      });
      expect(t.graphql.calls("VerifyMedia")[0].document).toContain(
        "dionysus_movies_by_pk(id: $id)",
      );
      expect(
        t.graphql.calls("CreateMediaAssetSearchConfiguration")[0].variables,
      ).toMatchObject({
        assetType: "movie",
        mediaId: MOVIE_ID,
        enabled: true,
        nextExecutionTime: "2026-09-18T12:15:00.000Z",
      });
      expect(t.amqp.publish).not.toHaveBeenCalled();
    });

    it("creates the configuration disabled when the asset already exists", async () => {
      t.graphql.on("VerifyMedia", {
        dionysus_movies_by_pk: { id: MOVIE_ID, asset: graphQlMediaAsset() },
      });

      await t
        .http()
        .post("/v1/dionysus/media/searchConfigurations")
        .send(body())
        .expect(201);

      expect(
        t.graphql.calls("CreateMediaAssetSearchConfiguration")[0].variables,
      ).toMatchObject({ enabled: false });
    });

    it("runs a TV series search immediately", async () => {
      t.graphql.on("VerifyMedia", { dionysus_tv_series_by_pk: { id: 1399 } });
      t.graphql.on("CreateMediaAssetSearchConfiguration", {
        insert_dionysus_media_asset_search_configuration_one:
          graphQlSearchConfiguration({
            assetType: "tv_series" as never,
            mediaId: 1399,
          }),
      });

      await t
        .http()
        .post("/v1/dionysus/media/searchConfigurations")
        .send(body({ type: "tv_series", mediaId: 1399 }))
        .expect(201);

      expect(t.graphql.calls("VerifyMedia")[0].document).not.toContain(
        "asset {",
      );
      expect(
        t.graphql.calls("CreateMediaAssetSearchConfiguration")[0].variables,
      ).toMatchObject({ nextExecutionTime: NOW.toISOString() });
      expect(t.amqp.publish).toHaveBeenCalledWith(
        "search.execution.trigger",
        "jobType.tv_series",
        { mediaId: 1399 },
        { persistent: true, headers: { "x-delay": 0 } },
      );
    });

    it("returns 400 when the media does not exist", async () => {
      t.graphql.on("VerifyMedia", { dionysus_movies_by_pk: null });

      await t
        .http()
        .post("/v1/dionysus/media/searchConfigurations")
        .send(body())
        .expect(400);

      expect(
        t.graphql.calls("CreateMediaAssetSearchConfiguration"),
      ).toHaveLength(0);
    });
  });

  describe("GET /v1/dionysus/media/searchConfiguration/:mediaType/:mediaId (DescribeMediaAssetSearchConfiguration)", () => {
    it("returns the configuration", async () => {
      t.graphql.on("DescribeMediaAssetSearchConfiguration", {
        dionysus_media_asset_search_configuration_by_pk:
          graphQlSearchConfiguration(),
      });

      const res = await t.http().get(CONFIG);

      expect(res.status).toBe(200);
      expect(res.body.searchConfiguration.mediaId).toBe(MOVIE_ID);
      expect(
        t.graphql.calls("DescribeMediaAssetSearchConfiguration")[0].variables,
      ).toEqual({ assetType: "movie", mediaId: MOVIE_ID });
    });

    it("returns 404 for an unknown configuration", async () => {
      t.graphql.on("DescribeMediaAssetSearchConfiguration", configMissing);

      await t.http().get(CONFIG).expect(404);
    });
  });

  describe("PUT /v1/dionysus/media/searchConfiguration/:mediaType/:mediaId (UpdateMediaAssetSearchConfiguration)", () => {
    it("reschedules the search when no next execution time is given", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.1);
      t.graphql.on("UpdateMediaAssetSearchConfiguration", {
        update_dionysus_media_asset_search_configuration_by_pk:
          graphQlSearchConfiguration({ enabled: false }),
      });

      const res = await t
        .http()
        .put(CONFIG)
        .send({ searchConfiguration: { enabled: false, jitter: 100 } });

      expect(res.status).toBe(200);
      const { variables } = t.graphql.calls(
        "UpdateMediaAssetSearchConfiguration",
      )[0];
      const changes = variables?.changes as Record<string, unknown>;
      expect(variables).toMatchObject({
        mediaType: "movie",
        mediaId: MOVIE_ID,
      });
      expect(changes.enabled).toBe(false);
      expect(JSON.parse(JSON.stringify(changes.nextExecutionTime))).toBe(
        "2026-09-18T12:10:00.000Z",
      );
    });

    it("cascades enabled to a series' children when recursive", async () => {
      t.graphql.on("UpdateMediaAssetSearchConfiguration", {
        update_dionysus_media_asset_search_configuration_by_pk:
          graphQlSearchConfiguration({
            assetType: "tv_series" as never,
            mediaId: 1399,
            enabled: false,
          }),
      });
      t.graphql.on("EnableChildSearchConfigurations", {
        update_dionysus_media_asset_search_configuration: { affected_rows: 8 },
      });

      await t
        .http()
        .put(
          "/v1/dionysus/media/searchConfiguration/tv_series/1399?recursive=true",
        )
        .send({ searchConfiguration: { enabled: false } })
        .expect(200);

      const call = t.graphql.calls("EnableChildSearchConfigurations")[0];
      expect(call.variables).toEqual({ enabled: false });
      expect(call.document).toContain("where: {seriesId: {_eq: 1399}}");
    });

    it("leaves children alone unless recursive", async () => {
      t.graphql.on("UpdateMediaAssetSearchConfiguration", {
        update_dionysus_media_asset_search_configuration_by_pk:
          graphQlSearchConfiguration({ assetType: "tv_series" as never }),
      });

      await t
        .http()
        .put("/v1/dionysus/media/searchConfiguration/tv_series/1399")
        .send({ searchConfiguration: { enabled: false } })
        .expect(200);

      expect(t.graphql.calls("EnableChildSearchConfigurations")).toHaveLength(
        0,
      );
    });

    it("returns 404 for an unknown configuration", async () => {
      t.graphql.on("UpdateMediaAssetSearchConfiguration", {
        update_dionysus_media_asset_search_configuration_by_pk: null,
      });

      await t
        .http()
        .put(CONFIG)
        .send({ searchConfiguration: { enabled: true } })
        .expect(404);
    });
  });

  describe("GET /v1/dionysus/media/searchConfigurations (ListMediaAssetSearchConfigurations)", () => {
    it("returns a page of configurations with their executions", async () => {
      t.graphql.on("ListMediaAssetSearchConfigurations", {
        dionysus_media_asset_search_configuration: [
          graphQlSearchConfigurationListItem(),
        ],
        dionysus_media_asset_search_configuration_aggregate: aggregate(55),
      });

      const res = await t
        .http()
        .get("/v1/dionysus/media/searchConfigurations")
        .query({
          filters: base64Json({ type: "eq", name: "enabled", value: true }),
        });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(55);
      expect(res.body.searchConfigurations[0].executions).toHaveLength(1);
      const { document } = t.graphql.calls(
        "ListMediaAssetSearchConfigurations",
      )[0];
      expect(document).toContain(
        "limit: 24, offset: 0, order_by: [{lastExecutionTime: desc}]",
      );
      expect(document).toContain("where: {enabled: {_eq: true}}");
    });
  });

  describe("PUT /v1/dionysus/media/searchConfiguration/:mediaType/:mediaId/running (GetMediaAssetSearchConfigurationsRunningCount)", () => {
    beforeEach(() => {
      t.graphql.on("GetMediaAssetSearchConfigurationsRunningCount", {
        dionysus_media_asset_search_configuration_aggregate: aggregate(3),
      });
    });
    const document = () =>
      t.graphql.calls("GetMediaAssetSearchConfigurationsRunningCount")[0]
        .document;

    it("counts a series' running season and episode searches", async () => {
      const res = await t
        .http()
        .put("/v1/dionysus/media/searchConfiguration/tv_series/1399/running");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ count: 3 });
      expect(document()).toContain('{status: {_eq: "running"}}');
      expect(document()).toContain("{seriesId: {_eq: 1399}}");
      expect(document()).toContain(
        '{assetType: {_in: ["tv_season", "tv_episode"]}}',
      );
    });

    it("counts a season's running episode searches", async () => {
      await t
        .http()
        .put(
          "/v1/dionysus/media/searchConfiguration/tv_season/1399/running?seasonNumber=2",
        )
        .expect(200);

      expect(document()).toContain("{seasonNumber: {_eq: 2}}");
      expect(document()).toContain('{assetType: {_in: ["tv_episode"]}}');
    });

    it.each([
      ["a movie", "/movie/603/running"],
      ["a season without seasonNumber", "/tv_season/1399/running"],
      ["a non-numeric seasonNumber", "/tv_season/1399/running?seasonNumber=x"],
    ])("rejects %s", async (_, suffix) => {
      await t
        .http()
        .put(`/v1/dionysus/media/searchConfiguration${suffix}`)
        .expect(400);
    });
  });

  describe("PUT /v1/dionysus/media/searchConfiguration/:mediaType/:mediaId/trigger (TriggerMediaAssetSearch)", () => {
    it("schedules the search and publishes a trigger", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      t.graphql.on("DescribeMediaAssetSearchConfiguration", {
        dionysus_media_asset_search_configuration_by_pk:
          graphQlSearchConfiguration(),
      });
      t.graphql.on("ScheduleMediaAssetSearch", {
        update_dionysus_media_asset_search_configuration_by_pk:
          graphQlSearchConfiguration(),
      });

      const res = await t.http().put(`${CONFIG}/trigger`);

      expect(res.status).toBe(200);
      expect(t.graphql.calls("ScheduleMediaAssetSearch")[0].variables).toEqual({
        mediaType: "movie",
        mediaId: MOVIE_ID,
        changes: { nextExecutionTime: NOW.toISOString() },
      });
      expect(t.amqp.publish).toHaveBeenCalledWith(
        "search.execution.trigger",
        "jobType.movie",
        {
          mediaId: MOVIE_ID,
          propagateImmediately: true,
          initiatingAsset: { assetType: "movie", mediaId: MOVIE_ID },
        },
        { persistent: true, headers: { "x-delay": 0 } },
      );
      expect(
        t.graphql.calls("MarkChildSearchConfigurationsRunning"),
      ).toHaveLength(0);
    });

    it("marks a season's episode searches as running", async () => {
      const season = graphQlSearchConfiguration({
        assetType: "tv_season" as never,
        mediaId: 3624,
        seriesId: 1399,
        seasonNumber: 2,
      });
      t.graphql.on("DescribeMediaAssetSearchConfiguration", {
        dionysus_media_asset_search_configuration_by_pk: season,
      });
      t.graphql.on("ScheduleMediaAssetSearch", {
        update_dionysus_media_asset_search_configuration_by_pk: season,
      });
      t.graphql.on("MarkChildSearchConfigurationsRunning", {
        update_dionysus_media_asset_search_configuration: { affected_rows: 10 },
      });

      await t
        .http()
        .put("/v1/dionysus/media/searchConfiguration/tv_season/3624/trigger")
        .expect(200);

      const call = t.graphql.calls("MarkChildSearchConfigurationsRunning")[0];
      expect(call.variables).toEqual({ status: "running" });
      expect(call.document).toContain(
        "where: {_and: [{seriesId: {_eq: 1399}}, {seasonNumber: {_eq: 2}}]}",
      );
      expect(t.amqp.publish.mock.calls[0][2]).toMatchObject({
        initiatingAsset: { seriesId: 1399, seasonNumber: 2 },
      });
    });

    it("returns 404 for an unknown configuration", async () => {
      t.graphql.on("DescribeMediaAssetSearchConfiguration", configMissing);

      await t.http().put(`${CONFIG}/trigger`).expect(404);

      expect(t.amqp.publish).not.toHaveBeenCalled();
    });
  });

  describe("search executions", () => {
    describe("POST .../executions (CreateMediaAssetSearchExecution)", () => {
      it("records a running execution for the configuration", async () => {
        t.graphql.on("VerifyMediaAssetSearchConfiguration", configExists);
        t.graphql.on("CreateMediaAssetSearchExecution", {
          insert_dionysus_media_asset_search_execution_one:
            graphQlSearchExecution({ status: "running" as never }),
        });

        const res = await t.http().post(`${CONFIG}/executions`).send({});

        expect(res.status).toBe(201);
        expect(res.body.searchExecution.id).toBe(EXECUTION_ID);
        expect(
          t.graphql.calls("CreateMediaAssetSearchExecution")[0].variables,
        ).toEqual({
          searchType: "movie",
          mediaId: MOVIE_ID,
          status: "running",
        });
      });

      it("returns 404 for an unknown configuration", async () => {
        t.graphql.on("VerifyMediaAssetSearchConfiguration", configMissing);

        await t.http().post(`${CONFIG}/executions`).send({}).expect(404);

        expect(t.graphql.calls("CreateMediaAssetSearchExecution")).toHaveLength(
          0,
        );
      });
    });

    describe("GET .../execution/:executionId (DescribeMediaAssetSearchExecution)", () => {
      it("returns the execution", async () => {
        t.graphql.on("DescribeMediaAssetSearchExecution", {
          dionysus_media_asset_search_execution_by_pk: graphQlSearchExecution(),
        });

        const res = await t.http().get(`${CONFIG}/execution/${EXECUTION_ID}`);

        expect(res.status).toBe(200);
        expect(res.body.searchExecution).toMatchObject({
          id: EXECUTION_ID,
          totalRecords: 4,
        });
        expect(
          t.graphql.calls("DescribeMediaAssetSearchExecution")[0].variables,
        ).toEqual({ executionId: EXECUTION_ID });
      });

      it.each([
        ["an unknown execution", null],
        [
          "an execution of another configuration",
          graphQlSearchExecution({ mediaId: 604 }),
        ],
      ])("returns 404 for %s", async (_, row) => {
        t.graphql.on("DescribeMediaAssetSearchExecution", {
          dionysus_media_asset_search_execution_by_pk: row,
        });

        await t.http().get(`${CONFIG}/execution/${EXECUTION_ID}`).expect(404);
      });
    });

    describe("PUT .../execution/:executionId (UpdateMediaAssetSearchExecution)", () => {
      it("applies the changes", async () => {
        t.graphql.on("UpdateMediaAssetSearchExecution", {
          update_dionysus_media_asset_search_execution_by_pk:
            graphQlSearchExecution(),
        });

        await t
          .http()
          .put(`${CONFIG}/execution/${EXECUTION_ID}`)
          .send({ searchExecution: { status: "success", newRecords: 3 } })
          .expect(200);

        expect(
          t.graphql.calls("UpdateMediaAssetSearchExecution")[0].variables,
        ).toEqual({
          executionId: EXECUTION_ID,
          changes: { status: "success", newRecords: 3 },
        });
      });

      it("returns 404 for an unknown execution", async () => {
        t.graphql.on("UpdateMediaAssetSearchExecution", {
          update_dionysus_media_asset_search_execution_by_pk: null,
        });

        await t
          .http()
          .put(`${CONFIG}/execution/missing`)
          .send({ searchExecution: { status: "success" } })
          .expect(404);
      });
    });

    describe("GET .../executions (ListMediaAssetSearchExecutions)", () => {
      it("lists the configuration's executions, newest first", async () => {
        t.graphql.on("ListMediaAssetSearchExecutions", {
          dionysus_media_asset_search_execution: [graphQlSearchExecution()],
          dionysus_media_asset_search_execution_aggregate: aggregate(1),
        });

        const res = await t.http().get(`${CONFIG}/executions`);

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        const { document } = t.graphql.calls(
          "ListMediaAssetSearchExecutions",
        )[0];
        expect(document).toContain("order_by: [{startedTime: desc}]");
        expect(document).toContain(
          `where: {_and: [{searchType: {_eq: "movie"}}, {mediaId: {_eq: ${MOVIE_ID}}}]}`,
        );
      });
    });
  });

  describe("search results", () => {
    describe("POST .../results (CreateMediaAssetSearchResult)", () => {
      const body = {
        searchResult: {
          id: RESULT_ID,
          title: "The.Matrix.1999.1080p.BluRay",
          score: 87,
          size: 8_000_000_000,
          password: 0,
          quality: "Bluray-1080p",
          qualityGroup: "HD",
          source: 7,
          modifier: 0,
          resolution: 1080,
          repack: false,
          postedTime: "2026-09-10T00:00:00Z",
        },
      };

      it("stores the result under the configuration", async () => {
        t.graphql.on("VerifyMediaAssetSearchConfiguration", configExists);
        t.graphql.on("CreateMediaAssetSearchResult", {
          insert_dionysus_media_asset_search_result_one: graphQlSearchResult(),
        });

        const res = await t.http().post(`${CONFIG}/results`).send(body);

        expect(res.status).toBe(201);
        expect(res.body.searchResult.id).toBe(RESULT_ID);
        expect(
          t.graphql.calls("CreateMediaAssetSearchResult")[0].variables,
        ).toMatchObject({
          id: RESULT_ID,
          assetType: "movie",
          mediaId: MOVIE_ID,
          tags: [],
        });
      });

      it("returns 404 for an unknown configuration", async () => {
        t.graphql.on("VerifyMediaAssetSearchConfiguration", configMissing);

        await t.http().post(`${CONFIG}/results`).send(body).expect(404);
      });
    });

    describe("GET .../result/:resultId (DescribeMediaAssetSearchResult)", () => {
      it("returns the result", async () => {
        t.graphql.on("DescribeMediaAssetSearchResult", {
          dionysus_media_asset_search_result_by_pk: graphQlSearchResult(),
        });

        const res = await t.http().get(`${CONFIG}/result/${RESULT_ID}`);

        expect(res.status).toBe(200);
        expect(res.body.searchResult.title).toContain("Matrix");
        expect(
          t.graphql.calls("DescribeMediaAssetSearchResult")[0].variables,
        ).toEqual({
          resultId: RESULT_ID,
          assetType: "movie",
          mediaId: MOVIE_ID,
        });
      });

      it("returns 404 for an unknown result", async () => {
        t.graphql.on("DescribeMediaAssetSearchResult", {
          dionysus_media_asset_search_result_by_pk: null,
        });

        await t.http().get(`${CONFIG}/result/missing`).expect(404);
      });
    });

    describe("GET .../results (ListMediaAssetSearchResults)", () => {
      it("lists the configuration's results", async () => {
        t.graphql.on("ListMediaAssetSearchResults", {
          dionysus_media_asset_search_result: [graphQlSearchResult()],
          dionysus_media_asset_search_result_aggregate: aggregate(12),
        });

        const res = await t
          .http()
          .get(`${CONFIG}/results?pageSize=10&startPage=1&sortBy=score`);

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(12);
        expect(
          t.graphql.calls("ListMediaAssetSearchResults")[0].document,
        ).toContain("limit: 10, offset: 10, order_by: [{score: desc}]");
      });
    });
  });
});
