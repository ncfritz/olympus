import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import fs from "fs";
import os from "os";
import path from "path";
import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaApi } from "@ncfritz/olympus-client";
import type {
  DownloadsConfigType,
  MediaConfigType,
} from "../../../src/config/configuration";
import { DownloadUpdateHandler } from "../../../src/downloads/handlers/DownloadUpdateHandler";
import type { NzbGetClient } from "../../../src/downloads/services/NzbGetClient";
import type { DownloadUpdateMessage } from "../../../src/messaging";

const base = { ts: 1, nzbFilename: null, nzbName: null, category: null };

const postProcess = (
  status: string,
  destDirectory: string,
): DownloadUpdateMessage => ({
  ...base,
  type: "post-process",
  destDirectory,
  nzbDirectory: null,
  status,
  nzbId: "17",
  scriptStatus: null,
  parStatus: null,
  unpackStatus: null,
});

const queue = (event: string, deleteStatus: string | null = null) =>
  ({
    ...base,
    type: "queue",
    destDirectory: null,
    nzbUrl: null,
    priority: null,
    nzbId: "17",
    event,
    status: null,
    deleteStatus,
  }) as DownloadUpdateMessage;

describe("DownloadUpdateHandler", () => {
  let root: string;
  let mediaApi: {
    updateMediaAssetDownloadByNzbId: ReturnType<typeof vi.fn>;
    updateMediaAssetWorkflow: ReturnType<typeof vi.fn>;
  };
  let nzbGet: { deleteHistory: ReturnType<typeof vi.fn> };
  let amqp: { publish: ReturnType<typeof vi.fn> };

  const handler = () =>
    new DownloadUpdateHandler(
      { stagingDirectory: `${root}/staging` } as MediaConfigType,
      { persistEvents: false } as DownloadsConfigType,
      amqp as unknown as AmqpConnection,
      mediaApi as unknown as MediaApi,
      nzbGet as unknown as NzbGetClient,
    );

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "dl-update-"));
    fs.mkdirSync(`${root}/complete`);
    mediaApi = {
      updateMediaAssetDownloadByNzbId: vi.fn(async () => ({
        workflowId: "wf-1",
      })),
      updateMediaAssetWorkflow: vi.fn(),
    };
    nzbGet = { deleteHistory: vi.fn() };
    amqp = { publish: vi.fn() };
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("marks an added NZB as downloading", async () => {
    await handler().handle(queue("NZB_ADDED"));

    expect(mediaApi.updateMediaAssetDownloadByNzbId).toHaveBeenCalledWith(
      17,
      expect.objectContaining({ status: "downloading" }),
      "downloading",
    );
  });

  it("cancels a deleted NZB without touching NZBGet's history", async () => {
    await handler().handle(queue("NZB_DELETED", "COPY"));

    expect(mediaApi.updateMediaAssetDownloadByNzbId).toHaveBeenCalledWith(
      17,
      expect.objectContaining({ status: "cancelled" }),
      "download_failed",
    );
    expect(nzbGet.deleteHistory).not.toHaveBeenCalled();
  });

  it("stages the downloaded media and starts its metadata extraction", async () => {
    fs.writeFileSync(`${root}/complete/movie.mkv`, "video");
    fs.writeFileSync(`${root}/complete/movie.nfo`, "info");

    await handler().handle(postProcess("SUCCESS/ALL", `${root}/complete`));

    expect(fs.readFileSync(`${root}/staging/wf-1/original.mkv`, "utf8")).toBe(
      "video",
    );
    expect(amqp.publish).toHaveBeenCalledWith(
      "media.trigger",
      "jobType.extractMetadata",
      { workflowId: "wf-1", mediaType: "original", mediaExtension: "mkv" },
      { persistent: true },
    );
    expect(nzbGet.deleteHistory).toHaveBeenCalledWith(17);
  });

  it("warns about extra media files only when there are some", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn");
    const multiple = () =>
      warn.mock.calls.filter(([message]) =>
        String(message).startsWith("Multiple media filenames"),
      );
    fs.writeFileSync(`${root}/complete/movie.mkv`, "video");

    await handler().handle(postProcess("SUCCESS/ALL", `${root}/complete`));
    expect(multiple()).toHaveLength(0);

    fs.writeFileSync(`${root}/complete/a.mkv`, "video");
    fs.writeFileSync(`${root}/complete/b.mp4`, "video");
    await handler().handle(postProcess("SUCCESS/ALL", `${root}/complete`));
    expect(multiple()).toHaveLength(1);

    warn.mockRestore();
  });

  it("fails the download and workflow when no media file arrived", async () => {
    fs.writeFileSync(`${root}/complete/movie.nfo`, "info");

    await handler().handle(postProcess("SUCCESS/ALL", `${root}/complete`));

    expect(mediaApi.updateMediaAssetWorkflow).toHaveBeenCalledWith(
      "wf-1",
      expect.objectContaining({ status: "failed" }),
    );
    expect(amqp.publish).not.toHaveBeenCalled();
  });

  it("fails the download and workflow when post-processing failed", async () => {
    await handler().handle(postProcess("FAILURE/PAR", `${root}/complete`));

    expect(mediaApi.updateMediaAssetDownloadByNzbId).toHaveBeenCalledWith(
      17,
      expect.objectContaining({ status: "failed" }),
      "download_failed",
    );
    expect(mediaApi.updateMediaAssetWorkflow).toHaveBeenCalledWith(
      "wf-1",
      expect.objectContaining({ status: "failed" }),
    );
    expect(nzbGet.deleteHistory).toHaveBeenCalledWith(17);
  });

  it("leaves a download without a workflow where NZBGet put it", async () => {
    mediaApi.updateMediaAssetDownloadByNzbId.mockResolvedValue({
      workflowId: null,
    });
    fs.writeFileSync(`${root}/complete/movie.mkv`, "video");

    await handler().handle(postProcess("SUCCESS/ALL", `${root}/complete`));

    expect(mediaApi.updateMediaAssetDownloadByNzbId).toHaveBeenCalledWith(
      17,
      expect.objectContaining({ status: "success" }),
      "downloaded",
    );
    expect(fs.existsSync(`${root}/complete/movie.mkv`)).toBe(true);
    expect(fs.existsSync(`${root}/staging`)).toBe(false);
    expect(amqp.publish).not.toHaveBeenCalled();
  });

  it("skips downloads the API does not know", async () => {
    mediaApi.updateMediaAssetDownloadByNzbId.mockResolvedValue(undefined);
    fs.writeFileSync(`${root}/complete/movie.mkv`, "video");

    await handler().handle(postProcess("SUCCESS/ALL", `${root}/complete`));

    expect(amqp.publish).not.toHaveBeenCalled();
  });
});
