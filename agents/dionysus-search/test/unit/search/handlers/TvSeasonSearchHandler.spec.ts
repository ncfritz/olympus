import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { beforeEach, describe, expect, it } from "vitest";
import { TvSeasonSearchHandler } from "../../../../src/search/handlers/TvSeasonSearchHandler";
import {
  as,
  executionUpdate,
  fakes,
  FUTURE,
  PAST,
} from "../../../fixtures/fakes";
import type { Fakes } from "../../../fixtures/fakes";

const episodeConfiguration = (
  mediaId: number,
  enabled: boolean,
  nextExecutionTime: string,
) => ({ type: "tv_episode", mediaId, enabled, nextExecutionTime });

describe("TvSeasonSearchHandler", () => {
  let f: Fakes;
  let handler: TvSeasonSearchHandler;

  beforeEach(() => {
    f = fakes();
    handler = new TvSeasonSearchHandler(
      as.mediaApi(f),
      as.notificationApi(f),
      as.metadataApi(f),
      as.amqp<AmqpConnection>(f),
    );
    f.metadataApi.describeTvSeason.mockResolvedValue({
      id: 20,
      seasonNumber: 2,
      series: { status: "Returning Series", numberOfSeasons: 2 },
      episodes: [1, 2, 3, 4].map((n) => ({
        id: 200 + n,
        seasonNumber: 2,
        episodeNumber: n,
      })),
    });
    f.mediaApi.describeMediaAssetSearchConfiguration.mockImplementation(
      async (type, id) =>
        (
          ({
            "tv_season:20": { enabled: true, seriesId: 5, seasonNumber: 2 },
            // 201: none yet
            "tv_episode:202": episodeConfiguration(202, false, PAST),
            "tv_episode:203": episodeConfiguration(203, true, PAST),
            "tv_episode:204": episodeConfiguration(204, true, FUTURE),
          }) as Record<string, unknown>
        )[`${type}:${id}`],
    );
  });

  it("fans out to the due episodes", async () => {
    await handler.handle({ mediaId: 20 });

    expect(f.metadataApi.describeTvSeason).toHaveBeenCalledWith(5, 2);
    expect(f.mediaApi.createMediaAssetSearchConfiguration).toHaveBeenCalledWith(
      {
        type: "tv_episode",
        mediaId: 201,
        backoff: 24,
        jitter: 300,
        enabled: true,
        status: "ok",
        seriesId: 5,
        seasonNumber: 2,
        episodeNumber: 1,
      },
    );
    expect(f.amqp.publish).toHaveBeenCalledTimes(1);
    expect(f.amqp.publish.mock.lastCall?.slice(0, 2)).toEqual([
      "search.execution.trigger",
      "jobType.tv_episode",
    ]);
    // The current season of a returning series keeps the daily defaults.
    expect(f.mediaApi.updateMediaAssetSearchConfiguration).toHaveBeenCalledWith(
      "tv_season",
      20,
      { backoff: 24, jitter: 300 },
    );
    expect(executionUpdate(f)[3]).toMatchObject({
      status: "success",
      totalRecords: 4,
      newRecords: 1,
      skippedRecords: 1,
      duplicateRecords: 2,
    });
  });

  it("passes the initiating asset down to the episodes", async () => {
    const initiatingAsset = {
      assetType: "tv_season",
      mediaId: 20,
      seriesId: 5,
      seasonNumber: 2,
    } as const;

    await handler.handle({
      mediaId: 20,
      propagateImmediately: true,
      initiatingAsset,
    });

    // Sends `episode` rather than InitiatingAsset's `episodeNumber`.
    expect(f.amqp.publish.mock.calls.map((call) => call[2])).toEqual([
      {
        mediaId: 203,
        propagateImmediately: true,
        initiatingAsset: { ...initiatingAsset, episode: 3 },
      },
      {
        mediaId: 204,
        propagateImmediately: true,
        initiatingAsset: { ...initiatingAsset, episode: 4 },
      },
    ]);
    expect(
      f.mediaApi.getMediaAssetSearchConfigurationsRunningCount,
    ).toHaveBeenCalledWith("tv_season", 5, 2);
  });

  it("uses the defaults when the series is missing", async () => {
    f.metadataApi.describeTvSeason.mockResolvedValue({
      id: 20,
      seasonNumber: 2,
      episodes: [],
    });
    await handler.handle({ mediaId: 20 });
    expect(f.mediaApi.updateMediaAssetSearchConfiguration).toHaveBeenCalledWith(
      "tv_season",
      20,
      { backoff: 24, jitter: 300 },
    );
  });
});
