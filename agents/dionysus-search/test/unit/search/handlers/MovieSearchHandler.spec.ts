import { beforeEach, describe, expect, it } from "vitest";
import { MovieSearchHandler } from "../../../../src/search/handlers/MovieSearchHandler";
import { as, executionUpdate, fakes, release } from "../../../fixtures/fakes";
import type { Fakes } from "../../../fixtures/fakes";

describe("MovieSearchHandler", () => {
  let f: Fakes;
  let handler: MovieSearchHandler;

  beforeEach(() => {
    f = fakes();
    handler = new MovieSearchHandler(
      as.mediaApi(f),
      as.notificationApi(f),
      as.metadataApi(f),
      as.nzbGeek(f),
    );
    f.metadataApi.describeMovie.mockResolvedValue({
      externalIds: [
        { type: "tmdb", externalId: "603" },
        { type: "imdb", externalId: "tt0133093" },
      ],
    });
  });

  it("stores new releases, skipping incomplete and known ones", async () => {
    f.nzbGeek.searchMovie.mockResolvedValue({
      status: 200,
      data: {
        channel: {
          item: [
            release("new"),
            release("known"),
            release("incomplete", "x", { guid: "incomplete" }),
          ],
        },
      },
    });
    f.mediaApi.describeMediaAssetSearchResult.mockImplementation(
      async (_type, _id, guid) => (guid === "known" ? { id: guid } : undefined),
    );

    await handler.handle({ mediaId: 7 });

    expect(f.mediaApi.createMediaAssetSearchExecution).toHaveBeenCalledWith(
      "movie",
      7,
    );
    expect(f.nzbGeek.searchMovie).toHaveBeenCalledWith("0133093");
    expect(f.mediaApi.createMediaAssetSearchResult).toHaveBeenCalledTimes(1);
    expect(f.mediaApi.createMediaAssetSearchResult).toHaveBeenCalledWith(
      "movie",
      7,
      expect.objectContaining({
        id: "new",
        assetType: "movie",
        mediaId: 7,
        status: "none",
        title: "The.Matrix.1999.1080p.BluRay.x264-SPARKS",
        size: 1000,
        password: 0,
        quality: "Bluray-1080p",
        qualityGroup: "Bluray",
        resolution: 1080,
        repack: false,
        postedTime: "2022-01-01T00:00:00.000Z",
      }),
    );
    expect(executionUpdate(f)).toEqual([
      "movie",
      7,
      "execution-1",
      expect.objectContaining({
        status: "success",
        newRecords: 1,
        duplicateRecords: 1,
        skippedRecords: 1,
        totalRecords: 0,
      }),
    ]);
  });

  it("skips movies without an IMDb ID", async () => {
    f.metadataApi.describeMovie.mockResolvedValue({ externalIds: [] });
    await handler.handle({ mediaId: 7 });
    expect(f.nzbGeek.searchMovie).not.toHaveBeenCalled();
    expect(executionUpdate(f)[3]).toMatchObject({ status: "skipped" });
  });

  it("skips when the indexer has nothing", async () => {
    await handler.handle({ mediaId: 7 });
    expect(executionUpdate(f)[3]).toMatchObject({ status: "skipped" });
  });

  it("fails on an indexer error status", async () => {
    f.nzbGeek.searchMovie.mockResolvedValue({ status: 503, data: {} });
    await handler.handle({ mediaId: 7 });
    expect(executionUpdate(f)[3]).toMatchObject({ status: "failed" });
  });

  it("records a failed search when the search throws", async () => {
    f.nzbGeek.searchMovie.mockRejectedValue(new Error("indexer down"));
    await expect(handler.handle({ mediaId: 7 })).resolves.toBeUndefined();
    expect(executionUpdate(f)[3]).toMatchObject({ status: "failed" });
  });

  it("completes the initiating search configuration and notifies", async () => {
    await handler.handle({
      mediaId: 7,
      propagateImmediately: true,
      initiatingAsset: { assetType: "movie", mediaId: 7 },
    });
    expect(f.mediaApi.updateMediaAssetSearchConfiguration).toHaveBeenCalledWith(
      "movie",
      7,
      expect.objectContaining({ status: "ok" }),
    );
    expect(f.notificationApi.sendNotification).toHaveBeenCalledWith({
      type: "dionysus_media_asset_search_refresh_complete",
      webSocketDestination: { closable: true, level: "success" },
      context: {
        assetType: "movie",
        mediaId: 7,
        media: { title: "Decorated" },
      },
    });
  });

  it("swallows API failures", async () => {
    f.mediaApi.createMediaAssetSearchExecution.mockRejectedValue(
      new Error("API down"),
    );
    await expect(handler.handle({ mediaId: 7 })).resolves.toBeUndefined();
  });
});
