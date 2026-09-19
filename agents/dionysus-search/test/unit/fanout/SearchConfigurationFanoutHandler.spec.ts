import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { beforeEach, describe, expect, it } from "vitest";
import { SearchConfigurationFanoutHandler } from "../../../src/fanout/handlers/SearchConfigurationFanoutHandler";
import { as, fakes } from "../../fixtures/fakes";
import type { Fakes } from "../../fixtures/fakes";

describe("SearchConfigurationFanoutHandler", () => {
  let f: Fakes;
  let handler: SearchConfigurationFanoutHandler;

  beforeEach(() => {
    f = fakes();
    handler = new SearchConfigurationFanoutHandler(
      as.amqp<AmqpConnection>(f),
      as.mediaApi(f),
    );
  });

  it("triggers the due search configurations, delayed", async () => {
    f.mediaApi.listMediaAssetSearchConfigurations.mockResolvedValue([
      { type: "movie", mediaId: 1 },
      { type: "tv_season", mediaId: 2, seriesId: 5, seasonNumber: 1 },
      {
        type: "tv_episode",
        mediaId: 3,
        seriesId: 5,
        seasonNumber: 1,
        episodeNumber: 4,
      },
    ]);

    await handler.handle({ maxEntriesToProcess: 25 });

    const [page, pageSize, sort, filter] = f.mediaApi
      .listMediaAssetSearchConfigurations.mock.calls[0] as unknown as [
      number,
      number,
      unknown,
      { value: { name: string }[] },
    ];
    expect([page, pageSize, sort]).toEqual([
      0,
      25,
      { field: "nextExecutionTime", order: "asc" },
    ]);
    expect(filter.value.map((v) => v.name)).toEqual([
      "enabled",
      "nextExecutionTime",
    ]);

    const calls = f.amqp.publish.mock.calls as unknown as [
      string,
      string,
      unknown,
      { persistent: boolean; headers: { "x-delay": number } },
    ][];
    expect(
      calls.map(([exchange, key, message]) => [exchange, key, message]),
    ).toEqual([
      [
        "search.execution.trigger",
        "jobType.movie",
        {
          mediaId: 1,
          propagateImmediately: true,
          initiatingAsset: { assetType: "movie", mediaId: 1 },
        },
      ],
      [
        "search.execution.trigger",
        "jobType.tv_season",
        {
          mediaId: 2,
          propagateImmediately: true,
          initiatingAsset: {
            assetType: "tv_season",
            mediaId: 2,
            seriesId: 5,
            seasonNumber: 1,
          },
        },
      ],
      [
        "search.execution.trigger",
        "jobType.tv_episode",
        {
          mediaId: 3,
          propagateImmediately: true,
          initiatingAsset: {
            assetType: "tv_episode",
            mediaId: 3,
            seriesId: 5,
            seasonNumber: 1,
            episodeNumber: 4,
          },
        },
      ],
    ]);
    for (const [, , , options] of calls) {
      expect(options.persistent).toBe(true);
      expect(options.headers["x-delay"]).toBeGreaterThanOrEqual(1000);
      expect(options.headers["x-delay"]).toBeLessThanOrEqual(60000);
    }
  });

  it("does nothing when nothing is due", async () => {
    await handler.handle({ maxEntriesToProcess: 25 });
    expect(f.amqp.publish).not.toHaveBeenCalled();
  });

  it("swallows API failures", async () => {
    f.mediaApi.listMediaAssetSearchConfigurations.mockRejectedValue(
      new Error("API down"),
    );
    await expect(
      handler.handle({ maxEntriesToProcess: 25 }),
    ).resolves.toBeUndefined();
  });
});
