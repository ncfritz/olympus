import { beforeEach, describe, expect, it } from "vitest";
import { TvEpisodeSearchHandler } from "../../../../src/search/handlers/TvEpisodeSearchHandler";
import {
  as,
  executionUpdate,
  fakes,
  FUTURE,
  PAST,
  release,
} from "../../../fixtures/fakes";
import type { Fakes } from "../../../fixtures/fakes";

describe("TvEpisodeSearchHandler", () => {
  let f: Fakes;
  let handler: TvEpisodeSearchHandler;

  const configuration = (nextExecutionTime: string) => ({
    enabled: true,
    seriesId: 5,
    seasonNumber: 5,
    episodeNumber: 14,
    nextExecutionTime,
  });

  beforeEach(() => {
    f = fakes();
    handler = new TvEpisodeSearchHandler(
      as.mediaApi(f),
      as.notificationApi(f),
      as.metadataApi(f),
      as.nzbGeek(f),
    );
    f.mediaApi.describeMediaAssetSearchConfiguration.mockResolvedValue(
      configuration(PAST),
    );
    f.metadataApi.describeTvEpisode.mockResolvedValue({
      seasonNumber: 5,
      episodeNumber: 14,
    });
    f.metadataApi.describeTvSeries.mockResolvedValue({
      externalIds: [{ type: "tvdb", externalId: "73244" }],
    });
    f.nzbGeek.searchTvEpisode.mockResolvedValue({
      status: 200,
      data: {
        channel: {
          item: [
            release("g", "The.Office.US.S05E14.720p.WEB-DL.DD5.1.H.264-NTb"),
          ],
        },
      },
    });
  });

  it("searches the indexer by TVDB ID and SxxEyy", async () => {
    await handler.handle({ mediaId: 514 });

    expect(f.metadataApi.describeTvEpisode).toHaveBeenCalledWith(5, 5, 14);
    expect(f.nzbGeek.searchTvEpisode).toHaveBeenCalledWith("73244", "S05E14");
    expect(f.mediaApi.createMediaAssetSearchResult).toHaveBeenCalledWith(
      "tv_episode",
      514,
      expect.objectContaining({ id: "g", quality: "WEBDL-720p" }),
    );
    expect(f.mediaApi.updateMediaAssetSearchConfiguration).toHaveBeenCalledWith(
      "tv_episode",
      514,
      { status: "ok" },
    );
    expect(executionUpdate(f)[3]).toMatchObject({
      status: "success",
      newRecords: 1,
    });
  });

  it("searches now when asked directly", async () => {
    f.mediaApi.describeMediaAssetSearchConfiguration.mockResolvedValue(
      configuration(FUTURE),
    );
    await handler.handle({ mediaId: 514, propagateImmediately: true });
    expect(f.nzbGeek.searchTvEpisode).toHaveBeenCalled();
  });

  it("moves a propagated search up instead of running it", async () => {
    f.mediaApi.describeMediaAssetSearchConfiguration.mockResolvedValue(
      configuration(FUTURE),
    );
    await handler.handle({
      mediaId: 514,
      propagateImmediately: true,
      initiatingAsset: { assetType: "tv_series", mediaId: 5 },
    });
    expect(f.nzbGeek.searchTvEpisode).not.toHaveBeenCalled();
    const [, , updates] = f.mediaApi.updateMediaAssetSearchConfiguration.mock
      .calls[0] as unknown as [string, number, Record<string, unknown>];
    expect(updates.status).toBe("ok");
    expect(Date.parse(updates.nextExecutionTime as string)).toBeLessThanOrEqual(
      Date.now(),
    );
  });

  it("fails without the episode's identifiers", async () => {
    f.mediaApi.describeMediaAssetSearchConfiguration.mockResolvedValue({
      ...configuration(PAST),
      episodeNumber: undefined,
    });
    await handler.handle({ mediaId: 514 });
    expect(f.nzbGeek.searchTvEpisode).not.toHaveBeenCalled();
    expect(executionUpdate(f)[3]).toMatchObject({ status: "failed" });
  });

  it("skips series without a TVDB ID", async () => {
    f.metadataApi.describeTvSeries.mockResolvedValue({ externalIds: [] });
    await handler.handle({ mediaId: 514 });
    expect(executionUpdate(f)[3]).toMatchObject({ status: "skipped" });
  });

  it("notifies when it was the initiating asset", async () => {
    await handler.handle({
      mediaId: 514,
      propagateImmediately: true,
      initiatingAsset: { assetType: "tv_episode", mediaId: 514 },
    });
    expect(f.nzbGeek.searchTvEpisode).toHaveBeenCalled();
    expect(f.notificationApi.sendNotification).toHaveBeenCalledTimes(1);
  });
});
