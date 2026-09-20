import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import type { Type } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONTENT_HANDLERS } from "../../src/content/ContentModule";
import { DeleteAssetHandler } from "../../src/content/handlers/DeleteAssetHandler";
import { HlsGenerationHandler } from "../../src/content/handlers/HlsGenerationHandler";
import { RawIngestionHandler } from "../../src/content/handlers/RawIngestionHandler";
import { ThumbnailGenerationHandler } from "../../src/content/handlers/ThumbnailGenerationHandler";
import { DOWNLOAD_HANDLERS } from "../../src/downloads/DownloadsModule";
import { DownloadUpdateHandler } from "../../src/downloads/handlers/DownloadUpdateHandler";
import { StartDownloadHandler } from "../../src/downloads/handlers/StartDownloadHandler";
import { DownloadStatusPoller } from "../../src/downloads/services/DownloadStatusPoller";
import { CleanupHandler } from "../../src/media/handlers/CleanupHandler";
import { ConfigureTranscodeHandler } from "../../src/media/handlers/ConfigureTranscodeHandler";
import { DeleteWorkflowHandler } from "../../src/media/handlers/DeleteWorkflowHandler";
import { ExtractMetadataHandler } from "../../src/media/handlers/ExtractMetadataHandler";
import { TranscodeConfigurationHandler } from "../../src/media/handlers/TranscodeConfigurationHandler";
import { TranscodeMediaHandler } from "../../src/media/handlers/TranscodeMediaHandler";
import { VerifyTranscodeConfigurationHandler } from "../../src/media/handlers/VerifyTranscodeConfigurationHandler";
import { MEDIA_HANDLERS } from "../../src/media/MediaModule";
import {
  CONTENT_SUBSCRIPTIONS,
  DOWNLOAD_SUBSCRIPTIONS,
  MEDIA_SUBSCRIPTIONS,
} from "../../src/messaging";

/** The @RabbitSubscribe configuration of a handler's handle(). */
const subscription = (handler: Type) => {
  const handle = (handler.prototype as { handle: object }).handle;
  return Reflect.getMetadataKeys(handle)
    .map((key) => Reflect.getMetadata(key, handle))
    .find((value) => value && typeof value === "object" && "queue" in value);
};

// Never connect to a broker.
AmqpConnection.prototype.init = async () => {};
AmqpConnection.prototype.close = async () => {};

/**
 * Resolves the whole dependency graph (compile() does not start the app)
 * and checks each handler's queue.
 */
describe("AppModule", () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    // Starts without a SOCKS proxy (content requests go direct).
    delete process.env.SOCKS_PROXY_HOST;
    const { AppModule } = await import("../../src/AppModule");
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterAll(async () => moduleRef.close());

  it("registers every handler of the handler maps", () => {
    const handlers = [
      ...Object.values(CONTENT_HANDLERS),
      ...Object.values(MEDIA_HANDLERS),
      ...Object.values(DOWNLOAD_HANDLERS),
    ];
    for (const handler of handlers) {
      expect(moduleRef.get(handler)).toBeInstanceOf(handler);
    }
  });

  it("polls NZBGet without a queue", () => {
    expect(moduleRef.get(DownloadStatusPoller)).toBeInstanceOf(
      DownloadStatusPoller,
    );
  });

  it.each([
    [RawIngestionHandler, CONTENT_SUBSCRIPTIONS.rawIngest],
    [HlsGenerationHandler, CONTENT_SUBSCRIPTIONS.hls],
    [ThumbnailGenerationHandler, CONTENT_SUBSCRIPTIONS.thumbnail],
    [DeleteAssetHandler, CONTENT_SUBSCRIPTIONS.delete],
    [ExtractMetadataHandler, MEDIA_SUBSCRIPTIONS.extractMetadata],
    [ConfigureTranscodeHandler, MEDIA_SUBSCRIPTIONS.configureTranscode],
    [TranscodeConfigurationHandler, MEDIA_SUBSCRIPTIONS.transcodeConfiguration],
    [
      VerifyTranscodeConfigurationHandler,
      MEDIA_SUBSCRIPTIONS.verifyTranscodeConfiguration,
    ],
    [TranscodeMediaHandler, MEDIA_SUBSCRIPTIONS.transcode],
    [CleanupHandler, MEDIA_SUBSCRIPTIONS.cleanup],
    [DeleteWorkflowHandler, MEDIA_SUBSCRIPTIONS.deleteWorkflow],
    [StartDownloadHandler, DOWNLOAD_SUBSCRIPTIONS.start],
    [DownloadUpdateHandler, DOWNLOAD_SUBSCRIPTIONS.update],
  ])("wires %o to its queue", (handler, expected) => {
    expect(subscription(handler as Type)).toMatchObject(expected);
  });
});
