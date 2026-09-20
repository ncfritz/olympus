import {
  describeMediaAssetSearchConfiguration,
  describeTvEpisode,
  listMediaAssetSearchConfigurations,
} from "@ncfritz/olympus-sdk/dionysus";
import { sendNotification } from "@ncfritz/olympus-sdk/olympus";
import { describe, expect, it, vi } from "vitest";
import { MediaApi } from "../../../src/api/MediaApi";
import { MetadataApi } from "../../../src/api/MetadataApi";
import { NotificationApi } from "../../../src/api/NotificationApi";

vi.mock("@ncfritz/olympus-sdk/dionysus", () => ({
  describeMediaAssetSearchConfiguration: vi.fn(async () => ({ data: {} })),
  describeTvEpisode: vi.fn(async () => ({ data: { episode: { id: 3 } } })),
  listMediaAssetSearchConfigurations: vi.fn(async () => ({
    data: { searchConfigurations: [{ mediaId: 1 }] },
  })),
}));
vi.mock("@ncfritz/olympus-sdk/olympus", () => ({
  sendNotification: vi.fn(async () => ({
    status: 200,
    data: { notificationId: "n" },
  })),
}));

describe("SDK wrappers", () => {
  it("unwrap the SDK responses", async () => {
    await expect(new MetadataApi().describeTvEpisode(1, 2, 3)).resolves.toEqual(
      { id: 3 },
    );
    expect(describeTvEpisode).toHaveBeenCalledWith({
      path: { tvSeriesId: 1, seasonNumber: 2, episodeNumber: 3 },
    });
  });

  it("treat a missing search configuration (404) as undefined", async () => {
    await expect(
      new MediaApi().describeMediaAssetSearchConfiguration("movie", 7),
    ).resolves.toBeUndefined();
    const [[options]] = vi.mocked(describeMediaAssetSearchConfiguration).mock
      .calls as unknown as [[{ validateStatus: (s: number) => boolean }]];
    expect([200, 404, 500].map(options.validateStatus)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("encode list filters as base64 JSON", async () => {
    const filters = { name: "enabled", type: "eq", value: true } as const;
    await expect(
      new MediaApi().listMediaAssetSearchConfigurations(
        0,
        5,
        undefined,
        filters,
      ),
    ).resolves.toEqual([{ mediaId: 1 }]);
    expect(listMediaAssetSearchConfigurations).toHaveBeenCalledWith({
      query: {
        pageSize: 5,
        sort: "desc",
        sortBy: "startedTime",
        startPage: 0,
        filters: Buffer.from(JSON.stringify(filters)).toString("base64"),
      },
    });
  });

  it("send notifications with metrics", async () => {
    await expect(
      new NotificationApi().sendNotification({ type: "t" } as never),
    ).resolves.toEqual({ notificationId: "n" });
    expect(sendNotification).toHaveBeenCalledWith({ body: { type: "t" } });
  });
});
