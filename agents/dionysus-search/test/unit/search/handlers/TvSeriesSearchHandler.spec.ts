import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { beforeEach, describe, expect, it } from "vitest";
import { TvSeriesSearchHandler } from "../../../../src/search/handlers/TvSeriesSearchHandler";
import {
  as,
  executionUpdate,
  fakes,
  FUTURE,
  PAST,
} from "../../../fixtures/fakes";
import type { Fakes } from "../../../fixtures/fakes";

const seasonConfiguration = (
  mediaId: number,
  enabled: boolean,
  nextExecutionTime: string,
) => ({ type: "tv_season", mediaId, enabled, nextExecutionTime });

describe("TvSeriesSearchHandler", () => {
  let f: Fakes;
  let handler: TvSeriesSearchHandler;

  beforeEach(() => {
    f = fakes();
    handler = new TvSeriesSearchHandler(
      as.mediaApi(f),
      as.notificationApi(f),
      as.metadataApi(f),
      as.amqp<AmqpConnection>(f),
    );
    f.metadataApi.describeTvSeries.mockResolvedValue({
      status: "Ended",
      numberOfSeasons: 4,
      seasons: [0, 1, 2, 3, 4].map((n) => ({ id: 100 + n, seasonNumber: n })),
    });
    f.mediaApi.describeMediaAssetSearchConfiguration.mockImplementation(
      async (type, id) =>
        (
          ({
            "tv_series:5": { enabled: true },
            // 101: none yet
            "tv_season:102": seasonConfiguration(102, false, PAST),
            "tv_season:103": seasonConfiguration(103, true, PAST),
            "tv_season:104": seasonConfiguration(104, true, FUTURE),
          }) as Record<string, unknown>
        )[`${type}:${id}`],
    );
  });

  it("fans out to the due seasons", async () => {
    await handler.handle({ mediaId: 5 });

    expect(f.mediaApi.createMediaAssetSearchConfiguration).toHaveBeenCalledWith(
      {
        type: "tv_season",
        mediaId: 101,
        backoff: 24,
        jitter: 300,
        enabled: true,
        status: "ok",
        seriesId: 5,
        seasonNumber: 1,
      },
    );
    expect(f.amqp.publish).toHaveBeenCalledTimes(1);
    expect(f.amqp.publish).toHaveBeenCalledWith(
      "search.execution.trigger",
      "jobType.tv_season",
      { mediaId: 103, propagateImmediately: undefined },
      { persistent: true },
    );
    // Ended series are searched weekly.
    expect(f.mediaApi.updateMediaAssetSearchConfiguration).toHaveBeenCalledWith(
      "tv_series",
      5,
      { backoff: 168, jitter: 2880, status: "ok" },
    );
    expect(executionUpdate(f)[3]).toMatchObject({
      status: "success",
      totalRecords: 5,
      newRecords: 1,
      duplicateRecords: 1,
      skippedRecords: 3,
    });
  });

  it("propagates immediately to every enabled season", async () => {
    const initiatingAsset = { assetType: "tv_series", mediaId: 5 } as const;
    f.mediaApi.getMediaAssetSearchConfigurationsRunningCount.mockResolvedValue(
      2,
    );

    await handler.handle({
      mediaId: 5,
      propagateImmediately: true,
      initiatingAsset,
    });

    expect(f.amqp.publish.mock.calls.map((call) => call[2])).toEqual([
      { mediaId: 103, propagateImmediately: true, initiatingAsset },
      { mediaId: 104, propagateImmediately: true, initiatingAsset },
    ]);
    // Seasons are still running: no completion notification yet.
    expect(
      f.mediaApi.getMediaAssetSearchConfigurationsRunningCount,
    ).toHaveBeenCalledWith("tv_series", 5);
    expect(f.notificationApi.sendNotification).not.toHaveBeenCalled();
  });

  it("notifies once nothing it fanned out to is still running", async () => {
    await handler.handle({
      mediaId: 5,
      initiatingAsset: { assetType: "tv_series", mediaId: 5 },
    });
    expect(f.notificationApi.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("skips disabled series", async () => {
    f.mediaApi.describeMediaAssetSearchConfiguration.mockResolvedValue({
      enabled: false,
    });
    await handler.handle({ mediaId: 5 });
    expect(f.metadataApi.describeTvSeries).not.toHaveBeenCalled();
    expect(executionUpdate(f)[3]).toMatchObject({ status: "skipped" });
  });

  it("fails without a search configuration", async () => {
    f.mediaApi.describeMediaAssetSearchConfiguration.mockResolvedValue(
      undefined,
    );
    await handler.handle({ mediaId: 5 });
    expect(executionUpdate(f)[3]).toMatchObject({ status: "failed" });
  });
});
