import axios from "axios";
import * as fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaApi } from "../../../../src/api/MediaApi";
import type { WorkflowApi } from "../../../../src/api/WorkflowApi";
import { EmailFormatters } from "../../../../src/channels/email/formatters/EmailFormatters";
import { EmailTemplates } from "../../../../src/channels/email/services/EmailTemplates";
import { smtpEvent } from "../../../fixtures/events";

vi.mock("axios");

const workflowApi = {
  describeWorkflow: vi.fn(),
  listWorkflowSteps: vi.fn(),
};
const mediaApi = { describeMediaAssetWorkflow: vi.fn() };

const formatters = new EmailFormatters(
  workflowApi as unknown as WorkflowApi,
  mediaApi as unknown as MediaApi,
  new EmailTemplates(),
);

const format = (
  notificationType: string,
  context: Record<string, unknown> = {},
) =>
  formatters
    .formatterFor(notificationType)!
    .formatNotification(smtpEvent({ notificationType, context }));

describe("EmailFormatters", () => {
  beforeEach(() => vi.resetAllMocks());

  it("has no formatter for other types", () => {
    expect(formatters.formatterFor("unknown")).toBeUndefined();
  });

  it("renders system_test, which has no CSS template", async () => {
    const email = await format("system_test");
    expect(email.subject).toBe("[Olympus] System Test");
    expect(email.plaintextPart).toContain("This is a test!");
    expect(email.htmlPart).toContain("This is a test!");
    expect(email.htmlPart).toContain("<title>Olympus</title>");
  });

  it("attaches the inline images of the partials the HTML uses, once", async () => {
    const first = await format("system_test");
    const second = await format("system_test");
    for (const email of [first, second]) {
      expect(email.attachments!.map((a) => a.cid)).toEqual([
        "t_olympus_header",
        "t_olympus_footer_logo",
      ]);
      for (const attachment of email.attachments!) {
        expect(fs.existsSync(attachment.path as string)).toBe(true);
      }
    }
  });

  it("renders the metadata workflow completion from the API", async () => {
    workflowApi.describeWorkflow.mockResolvedValue({
      id: "wf-1",
      status: "success",
      startedTime: "2026-09-19T10:00:00Z",
      finishedTime: "2026-09-19T11:00:00Z",
      steps: [],
    });
    workflowApi.listWorkflowSteps.mockResolvedValue([]);
    const email = await format("dionysus_metadata_workflow_completion", {
      workflowId: "wf-1",
    });
    expect(workflowApi.describeWorkflow).toHaveBeenCalledWith("wf-1");
    expect(email.subject).toContain("completed successfully");
    expect(email.htmlPart).toContain("wf-1");
    // The general layout, with its inline images, wraps the template.
    expect(email.htmlPart).toContain("<title>Olympus</title>");
    const cids = email.attachments!.map((a) => a.cid);
    expect(cids).toEqual(
      expect.arrayContaining(["t_olympus_header", "t_olympus_footer_logo"]),
    );
    for (const attachment of email.attachments!) {
      expect(fs.existsSync(attachment.path as string)).toBe(true);
    }
  });

  describe("dionysus_transcode_complete", () => {
    const workflow = (posterPath?: string) => ({
      id: "tw-1",
      type: "movie",
      status: "failed",
      decoration: { name: "Some Movie", posterPath },
      steps: [],
    });

    it("attaches a placeholder poster when there is none", async () => {
      mediaApi.describeMediaAssetWorkflow.mockResolvedValue(workflow());
      const email = await format("dionysus_transcode_complete", {
        workflowId: "tw-1",
      });
      expect(email.subject).toContain("Some Movie");
      expect(email.subject).toContain("failed");
      const poster = email.attachments!.find((a) => a.cid === "media_poster")!;
      expect(poster.path).toMatch(/templates\/images\/no_poster_[1-6]\.png$/);
      expect(fs.existsSync(poster.path as string)).toBe(true);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("attaches the TMDB poster inline", async () => {
      mediaApi.describeMediaAssetWorkflow.mockResolvedValue(
        workflow("/abc.jpg"),
      );
      vi.mocked(axios.get).mockResolvedValue({ data: Buffer.from("jpeg") });
      const email = await format("dionysus_transcode_complete", {
        workflowId: "tw-1",
      });
      expect(axios.get).toHaveBeenCalledWith(
        "https://image.tmdb.org/t/p/w342/abc.jpg",
        { responseType: "arraybuffer" },
      );
      const poster = email.attachments!.find((a) => a.cid === "media_poster")!;
      expect(poster).toMatchObject({
        filename: "poster.jpg",
        encoding: "base64",
        content: Buffer.from("jpeg").toString("base64"),
      });
      expect(poster.path).toBeUndefined();
    });

    it("falls back to the placeholder when TMDB fails", async () => {
      mediaApi.describeMediaAssetWorkflow.mockResolvedValue(
        workflow("/abc.jpg"),
      );
      vi.mocked(axios.get).mockRejectedValue(new Error("offline"));
      const email = await format("dionysus_transcode_complete", {
        workflowId: "tw-1",
      });
      const poster = email.attachments!.find((a) => a.cid === "media_poster")!;
      expect(poster.path).toMatch(/no_poster_[1-6]\.png$/);
    });
  });
});
