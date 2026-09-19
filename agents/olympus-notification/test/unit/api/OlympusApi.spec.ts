import {
  describeMediaAssetWorkflow,
  describeMetadataWorkflow,
  listMetadataWorkflowSteps,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  createNotification,
  type PartialNotification,
} from "@ncfritz/olympus-sdk/olympus";
import { describe, expect, it, vi } from "vitest";
import { MediaApi } from "../../../src/api/MediaApi";
import { NotificationApi } from "../../../src/api/NotificationApi";
import { WorkflowApi } from "../../../src/api/WorkflowApi";

vi.mock("@ncfritz/olympus-sdk/dionysus", () => ({
  describeMediaAssetWorkflow: vi.fn(async () => ({
    data: { workflow: { id: "mw" } },
  })),
  describeMetadataWorkflow: vi.fn(async () => ({
    data: { workflow: { id: "w" } },
  })),
  listMetadataWorkflowSteps: vi.fn(async () => ({
    data: { steps: [{ id: "s" }] },
  })),
}));
vi.mock("@ncfritz/olympus-sdk/olympus", () => ({
  createNotification: vi.fn(async () => ({
    data: { notification: { notificationId: "n" } },
  })),
}));

describe("SDK wrappers", () => {
  it("unwrap the SDK responses", async () => {
    await expect(new WorkflowApi().describeWorkflow("w")).resolves.toEqual({
      id: "w",
    });
    expect(describeMetadataWorkflow).toHaveBeenCalledWith({
      path: { workflowId: "w" },
    });
    await expect(new WorkflowApi().listWorkflowSteps("w")).resolves.toEqual([
      { id: "s" },
    ]);
    expect(listMetadataWorkflowSteps).toHaveBeenCalledWith({
      path: { workflowId: "w" },
    });
    await expect(
      new MediaApi().describeMediaAssetWorkflow("mw"),
    ).resolves.toEqual({ id: "mw" });
    expect(describeMediaAssetWorkflow).toHaveBeenCalledWith({
      path: { workflowId: "mw" },
    });
    await expect(
      new NotificationApi().createNotification({
        notificationId: "n",
      } as PartialNotification),
    ).resolves.toEqual({ notificationId: "n" });
    expect(createNotification).toHaveBeenCalledWith({
      body: { notification: { notificationId: "n" } },
    });
  });
});
