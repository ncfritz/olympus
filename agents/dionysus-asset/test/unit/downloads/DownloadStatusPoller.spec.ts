import { describe, expect, it, vi } from "vitest";
import type { MediaApi } from "../../../src/api/MediaApi";
import {
  DownloadStatusPoller,
  downloadStatus,
} from "../../../src/downloads/services/DownloadStatusPoller";
import type {
  NzbGetClient,
  NzbGetGroup,
} from "../../../src/downloads/services/NzbGetClient";

describe("downloadStatus", () => {
  it.each([
    ["QUEUED", "pending"],
    ["PAUSED", "pending"],
    ["DOWNLOADING", "downloading"],
    ["UNPACKING", "downloading"],
    ["PP_FINISHED", "downloading"],
    ["SOMETHING_NEW", "pending"],
  ])("maps %s to %s", (status, expected) => {
    expect(downloadStatus(status)).toBe(expected);
  });
});

describe("DownloadStatusPoller", () => {
  const poller = (groups: NzbGetGroup[]) => {
    const mediaApi = { bulkUpdateMediaAssetDownloads: vi.fn() };
    const nzbGet = {
      listGroups: vi.fn(async () => ({
        status: 200,
        data: { result: groups },
      })),
    };
    return {
      mediaApi,
      poller: new DownloadStatusPoller(
        nzbGet as unknown as NzbGetClient,
        mediaApi as unknown as MediaApi,
      ),
    };
  };

  it("copies NZBGet's queue to the downloads", async () => {
    const { mediaApi, poller: p } = poller([
      { NZBID: 7, Status: "DOWNLOADING", FileSizeMB: 200, RemainingSizeMB: 50 },
    ]);

    await p.poll();

    expect(mediaApi.bulkUpdateMediaAssetDownloads).toHaveBeenCalledWith([
      { nzbId: 7, status: "downloading", progress: 75 },
    ]);
  });

  it("reports no progress for groups of unknown or tiny size", async () => {
    const { mediaApi, poller: p } = poller([
      { NZBID: 8, Status: "QUEUED", FileSizeMB: 0, RemainingSizeMB: 0 },
    ]);

    await p.poll();

    expect(mediaApi.bulkUpdateMediaAssetDownloads).toHaveBeenCalledWith([
      { nzbId: 8, status: "pending", progress: 0 },
    ]);
  });

  it("does not call the API when the queue is empty", async () => {
    const { mediaApi, poller: p } = poller([]);
    await p.poll();
    expect(mediaApi.bulkUpdateMediaAssetDownloads).not.toHaveBeenCalled();
  });
});
