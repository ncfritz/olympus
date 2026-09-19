import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaApi } from "../../../src/api/MediaApi";
import type { MediaConfigType } from "../../../src/config/configuration";
import { StartDownloadHandler } from "../../../src/downloads/handlers/StartDownloadHandler";
import type { NzbGeekClient } from "../../../src/downloads/services/NzbGeekClient";
import type { NzbGetClient } from "../../../src/downloads/services/NzbGetClient";
import type { StartDownloadMessage } from "../../../src/messaging";
import { NZB_XML } from "../../fixtures/nzb";

describe("StartDownloadHandler", () => {
  let stagingDirectory: string;
  let mediaApi: {
    updateMediaAssetDownload: ReturnType<typeof vi.fn>;
    updateMediaAssetWorkflow: ReturnType<typeof vi.fn>;
  };
  let nzbGet: { url: string; append: ReturnType<typeof vi.fn> };

  const msg: StartDownloadMessage = {
    mediaType: "movie",
    mediaId: 42,
    resultId: "result-1",
    workflowId: "wf-1",
    downloadId: "download-1",
    nzbId: `test-${process.pid}`,
  };

  const handler = () =>
    new StartDownloadHandler(
      { stagingDirectory } as MediaConfigType,
      mediaApi as unknown as MediaApi,
      {
        getNzb: vi.fn(async () => Readable.from([NZB_XML])),
      } as unknown as NzbGeekClient,
      nzbGet as unknown as NzbGetClient,
    );

  beforeEach(() => {
    stagingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "start-dl-"));
    mediaApi = {
      updateMediaAssetDownload: vi.fn(),
      updateMediaAssetWorkflow: vi.fn(),
    };
    nzbGet = { url: "http://nzbget/jsonrpc", append: vi.fn() };
  });

  afterEach(() => {
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
    fs.rmSync(`/tmp/${msg.nzbId}.nzb`, { force: true });
  });

  it("queues the NZB, records its id and writes nzbMeta.json", async () => {
    nzbGet.append.mockResolvedValue({ status: 200, data: { result: 17 } });

    await handler().handle(msg);

    expect(nzbGet.append).toHaveBeenCalledWith(
      "Some.Movie.2019.1080p.mkv",
      NZB_XML,
    );
    expect(mediaApi.updateMediaAssetDownload).toHaveBeenCalledWith(
      "movie",
      42,
      "result-1",
      "download-1",
      { nzbId: 17 },
    );
    const meta = JSON.parse(
      fs.readFileSync(`${stagingDirectory}/wf-1/nzbMeta.json`, "utf8"),
    );
    expect(meta).toMatchObject({ size: 1800, parSize: 100 });
    expect(mediaApi.updateMediaAssetWorkflow).not.toHaveBeenCalled();
  });

  it("fails the download and workflow when NZBGet refuses the NZB", async () => {
    nzbGet.append.mockResolvedValue({
      status: 200,
      data: { result: false, error: "no" },
    });

    await handler().handle(msg);

    expect(mediaApi.updateMediaAssetDownload).toHaveBeenCalledWith(
      "movie",
      42,
      "result-1",
      "download-1",
      expect.objectContaining({ status: "failed" }),
    );
    expect(mediaApi.updateMediaAssetWorkflow).toHaveBeenCalledWith(
      "wf-1",
      expect.objectContaining({ status: "failed" }),
    );
  });
});
