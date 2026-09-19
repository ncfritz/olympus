import { afterEach, describe, expect, it } from "vitest";
import { TranscodeMediaHandler } from "../../../../src/media/handlers/TranscodeMediaHandler";
import { transcodeFakes } from "../../../fixtures/media";

const msg = { workflowId: "wf-1", mediaExtension: "mkv" };

describe("TranscodeMediaHandler", () => {
  let fakes: ReturnType<typeof transcodeFakes>;

  afterEach(() => fakes.cleanup());

  it("uploads the transcode to the library and records the asset", async () => {
    fakes = transcodeFakes();

    await new TranscodeMediaHandler(...fakes.deps).handle(msg);

    expect(fakes.workflow.upload).toHaveBeenCalledWith(
      { "transcoded.mp4": "/Movies/T/The Matrix (1999).mp4" },
      expect.objectContaining({ host: "library" }),
      expect.any(Function),
    );
    expect(fakes.mediaApi.createMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "movie",
        mediaId: 603,
        assetSha: "sha",
        originalSizeBytes: 5000,
        width: 1920,
        height: 1080,
        durationMs: 7_200_500,
      }),
    );
    expect(fakes.amqp.publish).toHaveBeenCalledWith(
      "media.trigger",
      "jobType.cleanup",
      { workflowId: "wf-1", mediaExtension: "mkv" },
    );
  });

  it("stops when the transcode fails", async () => {
    fakes = transcodeFakes();
    fakes.workflow.transcode.mockRejectedValue(new Error("HandBrake died"));

    await new TranscodeMediaHandler(...fakes.deps).handle(msg);

    expect(fakes.reporter.updateStepStatus).toHaveBeenCalledWith(
      "wf-1",
      "transcode",
      "failed",
    );
    expect(fakes.workflow.extractMetadata).not.toHaveBeenCalled();
    expect(fakes.workflow.upload).not.toHaveBeenCalled();
    expect(fakes.mediaApi.createMediaAsset).not.toHaveBeenCalled();
    expect(fakes.amqp.publish).not.toHaveBeenCalled();
  });
});
