import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaConfigType } from "../../../../src/config/configuration";
import type { MediaReporter } from "../../../../src/media/services/MediaReporter";
import { MediaWorkflow } from "../../../../src/media/services/MediaWorkflow";
import type { Handbrake } from "../../../../src/tools/handbrake/Handbrake";
import { IngestError } from "../../../../src/tools/errors/IngestError";
import { FakeSftp } from "../../../fixtures/sftp";

vi.mock("ssh2-sftp-client", async () => ({
  default: (await import("../../../fixtures/sftp")).FakeSftp,
}));

describe("MediaWorkflow.upload", () => {
  let root: string;
  let workflow: MediaWorkflow;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "media-workflow-"));
    workflow = new MediaWorkflow("wf-1", "mkv", undefined, {
      config: {
        stagingDirectory: `${root}/staging`,
        localDirectory: `${root}/local`,
        skipCdnDownload: false,
      } as MediaConfigType,
      reporter: {} as MediaReporter,
      handbrake: {} as Handbrake,
    });
    fs.mkdirSync(workflow.stagingDir, { recursive: true });
    fs.writeFileSync(`${workflow.stagingDir}/metadata.json`, "{}");
  });

  afterEach(() => {
    FakeSftp.reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("uploads the files over one connection and closes it", async () => {
    await workflow.upload(
      { "metadata.json": "/Dionysus/workflow/wf-1/metadata.json" },
      { host: "cdn" },
    );

    const [client] = FakeSftp.instances;
    expect(client.puts).toEqual(["/Dionysus/workflow/wf-1/metadata.json"]);
    expect(client.ended).toBe(true);
  });

  it("closes the connection when an upload fails", async () => {
    FakeSftp.failPut = true;

    await expect(
      workflow.upload({ "metadata.json": "/x/metadata.json" }, { host: "cdn" }),
    ).rejects.toThrow(IngestError);
    expect(FakeSftp.instances[0].ended).toBe(true);
  });
});
