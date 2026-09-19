import { describe, expect, it } from "vitest";
import { WebSocketFormatters } from "../../../../src/channels/websocket/formatters/WebSocketFormatters";
import { webSocketEvent } from "../../../fixtures/events";

describe("WebSocketFormatters", () => {
  const formatters = new WebSocketFormatters();

  it("sends a plain test message, overridable from the context", async () => {
    const formatter = formatters.formatterFor("system_test")!;
    await expect(
      formatter.formatNotification(webSocketEvent()),
    ).resolves.toEqual({
      type: "plain",
      value: { title: "Test", message: "This is a test message" },
    });
    await expect(
      formatter.formatNotification(
        webSocketEvent({ context: { title: "T", message: "M" } }),
      ),
    ).resolves.toEqual({ type: "plain", value: { title: "T", message: "M" } });
  });

  it.each([
    "dionysus_batch_job_complete",
    "dionysus_metadata_workflow_completion",
    "dionysus_media_asset_search_refresh_complete",
    "dionysus_transcode_complete",
  ])("passes the %s context to the browser", async (type) => {
    const context = { workflowId: "w-1" };
    await expect(
      formatters
        .formatterFor(type)!
        .formatNotification(
          webSocketEvent({ notificationType: type, context }),
        ),
    ).resolves.toEqual({ type: "context", value: context });
  });

  it("has no formatter for other types", () => {
    expect(formatters.formatterFor("unknown")).toBeUndefined();
  });
});
