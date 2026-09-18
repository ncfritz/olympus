import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aggregate } from "../../fixtures/dionysus";
import {
  DOWNLOAD_ID,
  graphQlDecoratedDownload,
  graphQlDownload,
  graphQlFavorite,
  graphQlMediaAsset,
  graphQlMediaWorkflowStep,
  MOVIE_ID,
  RESULT_ID,
} from "../../fixtures/media";
import { base64Json } from "../../fixtures/olympus";
import { createTestApp, type TestApp } from "../../support/testApp";

const RESULT = `/v1/dionysus/media/searchConfiguration/movie/${MOVIE_ID}/result/${RESULT_ID}`;

describe("Dionysus media downloads, assets and favorites API", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(() => t.reset());

  describe("downloads", () => {
    describe("POST .../result/:resultId/download (CreateMediaAssetDownload)", () => {
      it("creates the download, marks the result and starts it", async () => {
        t.graphql.on("VerifyMediaAssetSearchResult", {
          dionysus_media_asset_search_result_by_pk: {
            assetType: "movie",
            mediaId: MOVIE_ID,
            id: RESULT_ID,
          },
        });
        t.graphql.on("CreateMediaAssetDownload", {
          insert_dionysus_media_asset_download_one: graphQlDownload({
            status: "pending" as never,
            progress: 0,
          }),
          update_dionysus_media_asset_search_result_by_pk: {
            status: "download_requested",
          },
        });

        const res = await t.http().post(`${RESULT}/download`);

        expect(res.status).toBe(201);
        expect(res.body.download).toMatchObject({
          id: DOWNLOAD_ID,
          progress: 0,
        });
        const { document, variables } = t.graphql.calls(
          "CreateMediaAssetDownload",
        )[0];
        // Each variable is declared once (duplicates fail GraphQL validation).
        expect(document.match(/\$assetType:/g)).toHaveLength(1);
        expect(document.match(/\$mediaId:/g)).toHaveLength(1);
        expect(variables).toEqual({
          status: "pending",
          progress: 0,
          searchResultId: RESULT_ID,
          assetType: "movie",
          mediaId: MOVIE_ID,
          searchResultStatus: "download_requested",
        });
        expect(t.amqp.publish).toHaveBeenCalledWith(
          "download.trigger",
          "download.start",
          {
            mediaType: "movie",
            mediaId: MOVIE_ID,
            resultId: RESULT_ID,
            downloadId: DOWNLOAD_ID,
            nzbId: RESULT_ID,
          },
          { persistent: true, headers: { "x-delay": 10000 } },
        );
      });

      it("returns 404 for an unknown search result", async () => {
        t.graphql.on("VerifyMediaAssetSearchResult", {
          dionysus_media_asset_search_result_by_pk: null,
        });

        await t.http().post(`${RESULT}/download`).expect(404);
      });
    });

    describe("PUT .../download/:downloadId (UpdateMediaAssetDownload)", () => {
      it("applies the changes", async () => {
        t.graphql.on("UpdateMediaAssetDownload", {
          update_dionysus_media_asset_download_by_pk: graphQlDownload({
            progress: 80,
          }),
        });

        const res = await t
          .http()
          .put(`${RESULT}/download/${DOWNLOAD_ID}`)
          .send({ download: { progress: 80 } });

        expect(res.status).toBe(200);
        expect(res.body.download.progress).toBe(80);
        expect(
          t.graphql.calls("UpdateMediaAssetDownload")[0].variables,
        ).toEqual({
          downloadId: DOWNLOAD_ID,
          searchResultId: RESULT_ID,
          changes: { progress: 80 },
        });
      });

      it("returns 404 for an unknown download", async () => {
        t.graphql.on("UpdateMediaAssetDownload", {
          update_dionysus_media_asset_download_by_pk: null,
        });

        await t
          .http()
          .put(`${RESULT}/download/missing`)
          .send({ download: { progress: 1 } })
          .expect(404);
      });
    });

    describe("PUT /v1/dionysus/media/download/:nzbId (UpdateMediaAssetDownloadByNzbId)", () => {
      beforeEach(() => {
        t.graphql.on("LookupDownloadByNzbId", {
          dionysus_media_asset_download: [
            {
              id: DOWNLOAD_ID,
              progress: 60,
              status: "downloading",
              searchResult: {
                assetType: "movie",
                mediaId: MOVIE_ID,
                id: RESULT_ID,
              },
            },
          ],
        });
        t.graphql.on("UpdateMediaAssetDownloadByNzbId", {
          update_dionysus_media_asset_download_by_pk: graphQlDownload(),
          update_dionysus_media_asset_search_result_by_pk: {
            status: "downloading",
          },
        });
      });
      const variables = () =>
        t.graphql.calls("UpdateMediaAssetDownloadByNzbId")[0].variables;

      it("updates the download and its search result", async () => {
        await t
          .http()
          .put("/v1/dionysus/media/download/42")
          .send({
            download: { progress: 70, status: "downloading" },
            searchResultStatus: "downloading",
          })
          .expect(200);

        expect(t.graphql.calls("LookupDownloadByNzbId")[0].variables).toEqual({
          nzbId: 42,
        });
        expect(variables()).toEqual({
          downloadId: DOWNLOAD_ID,
          searchResultId: RESULT_ID,
          assetType: "movie",
          mediaId: MOVIE_ID,
          searchResultStatus: "downloading",
          changes: { progress: 70, status: "downloading" },
        });
      });

      it("never moves progress backwards", async () => {
        await t
          .http()
          .put("/v1/dionysus/media/download/42")
          .send({
            download: { progress: 20 },
            searchResultStatus: "downloading",
          })
          .expect(200);

        expect(variables()?.changes).toEqual({ progress: 60 });
      });

      it("returns 404 for an unknown NZB", async () => {
        t.graphql.on("LookupDownloadByNzbId", {
          dionysus_media_asset_download: [],
        });

        await t
          .http()
          .put("/v1/dionysus/media/download/7")
          .send({
            download: { progress: 1 },
            searchResultStatus: "downloading",
          })
          .expect(404);
      });

      it("rejects a non-numeric NZB ID", async () => {
        await t
          .http()
          .put("/v1/dionysus/media/download/abc")
          .send({ download: {} })
          .expect(400);
      });
    });

    describe("PUT /v1/dionysus/media/downloads/bulk (BulkUpdateMediaAssetDownloads)", () => {
      it("updates each download by NZB ID using variables", async () => {
        t.graphql.on("BulkUpdateMediaAssetDownloads", {
          update0: {
            returning: [graphQlDownload({ nzbId: 42, progress: 90 })],
          },
          update1: { returning: [] },
        });

        const res = await t
          .http()
          .put("/v1/dionysus/media/downloads/bulk")
          .send({
            updates: [
              { nzbId: 42, progress: 90, status: "downloading" },
              { nzbId: 43, progress: 10, status: 'x"}) { id } y: z(' },
              { progress: 5, status: "failed" },
            ],
          });

        expect(res.status).toBe(200);
        expect(res.body.updates).toHaveLength(1);
        expect(res.body.updates[0]).toMatchObject({ nzbId: 42, progress: 90 });
        const { document, variables } = t.graphql.calls(
          "BulkUpdateMediaAssetDownloads",
        )[0];
        expect(variables).toEqual({
          nzbId0: 42,
          progress0: 90,
          status0: "downloading",
          nzbId1: 43,
          progress1: 10,
          status1: 'x"}) { id } y: z(',
        });
        expect(document).not.toContain("y: z(");
        expect(document).not.toContain("update2");
      });

      it("answers an empty list without calling Hasura", async () => {
        const res = await t
          .http()
          .put("/v1/dionysus/media/downloads/bulk")
          .send({ updates: [] });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ updates: [] });
        expect(t.graphql.request).not.toHaveBeenCalled();
      });
    });

    describe("GET /v1/dionysus/media/downloads (ListMediaAssetDownloads)", () => {
      it("returns a page of decorated downloads", async () => {
        t.graphql.on("ListMediaAssetDownloads", {
          dionysus_media_asset_download: [graphQlDecoratedDownload()],
          dionysus_media_asset_download_aggregate: aggregate(6),
        });

        const res = await t
          .http()
          .get("/v1/dionysus/media/downloads")
          .query({
            filters: base64Json({
              type: "eq",
              name: "status",
              value: "failed",
            }),
          });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(6);
        expect(res.body.downloads[0].decoration.name).toBe("The Matrix");
        const { document } = t.graphql.calls("ListMediaAssetDownloads")[0];
        expect(document).toContain("order_by: [{startedTime: desc}]");
        expect(document).toContain('where: {status: {_eq: "failed"}}');
      });
    });
  });

  describe("GET /v1/dionysus/media/transcodes (ListMediaAssetTranscodes)", () => {
    it("lists transcode steps, combined with the caller's filters", async () => {
      t.graphql.on("ListMediaAssetTranscodes", {
        dionysus_media_asset_workflow_step: [graphQlMediaWorkflowStep()],
        dionysus_media_asset_workflow_step_aggregate: aggregate(1),
      });

      const res = await t
        .http()
        .get("/v1/dionysus/media/transcodes")
        .query({
          filters: base64Json({ type: "eq", name: "status", value: "running" }),
        });

      expect(res.status).toBe(200);
      expect(res.body.steps).toHaveLength(1);
      expect(t.graphql.calls("ListMediaAssetTranscodes")[0].document).toContain(
        'where: {_and: [{type: {_eq: "transcode"}}, {status: {_eq: "running"}}]}',
      );
    });
  });

  describe("POST /v1/dionysus/media/assets (CreateMediaAsset)", () => {
    it("upserts the asset and returns 201", async () => {
      t.graphql.on("CreateMediaAsset", {
        insert_dionysus_media_asset_one: graphQlMediaAsset(),
      });

      const res = await t
        .http()
        .post("/v1/dionysus/media/assets")
        .send({
          asset: {
            type: "movie",
            mediaId: MOVIE_ID,
            filePath: "/media/movies/The Matrix (1999).mkv",
            assetSha: "abc123",
            originalSizeBytes: 8_000_000_000,
            newSizeBytes: 4_000_000_000,
            durationMs: 8_160_000,
            width: 1920,
            height: 1080,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.asset).toMatchObject({ mediaId: MOVIE_ID, width: 1920 });
      expect(t.graphql.calls("CreateMediaAsset")[0].variables).toEqual({
        assetType: "movie",
        mediaId: MOVIE_ID,
        filePath: "/media/movies/The Matrix (1999).mkv",
        assetSha: "abc123",
        originalSize: 8_000_000_000,
        newSize: 4_000_000_000,
        duration: 8_160_000,
        width: 1920,
        height: 1080,
      });
    });
  });

  describe("favorites", () => {
    const FAVORITE = `/v1/dionysus/media/favorite/movie/${MOVIE_ID}`;

    describe("POST (CreateMediaFavorite)", () => {
      it("favorites existing media", async () => {
        t.graphql.on("GetMediaIdForAsset", {
          dionysus_media_id_one: { id: MOVIE_ID },
        });
        t.graphql.on("CreateMediaFavorite", {
          insert_dionysus_media_favorite_one: graphQlFavorite(),
        });

        const res = await t.http().post(FAVORITE);

        expect(res.status).toBe(201);
        expect(res.body.favorite.decoration.name).toBe("The Matrix");
        expect(t.graphql.calls("GetMediaIdForAsset")[0].document).toContain(
          "dionysus_movies_by_pk(id: $id)",
        );
        expect(t.graphql.calls("CreateMediaFavorite")[0].variables).toEqual({
          assetType: "movie",
          mediaId: MOVIE_ID,
        });
      });

      it("returns 404 for unknown media", async () => {
        t.graphql.on("GetMediaIdForAsset", { dionysus_media_id_one: null });

        await t.http().post(FAVORITE).expect(404);

        expect(t.graphql.calls("CreateMediaFavorite")).toHaveLength(0);
      });

      it("rejects an unknown media type", async () => {
        await t.http().post("/v1/dionysus/media/favorite/book/1").expect(400);
      });
    });

    describe("DELETE (DeleteMediaFavorite)", () => {
      it("removes the favorite and answers 410", async () => {
        t.graphql.on("DeleteMediaFavorite", {
          delete_dionysus_media_favorite_by_pk: graphQlFavorite(),
        });

        const res = await t.http().delete(FAVORITE);

        expect(res.status).toBe(410);
        expect(res.body.favorite).toBeDefined();
      });

      it("returns 404 when it was not a favorite", async () => {
        t.graphql.on("DeleteMediaFavorite", {
          delete_dionysus_media_favorite_by_pk: null,
        });

        await t.http().delete(FAVORITE).expect(404);
      });
    });
  });
});
