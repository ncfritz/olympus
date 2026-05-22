import type { MediaAssetWorkflowStatus } from "@ncfritz/olympus-sdk/dionysus";

export const getWorkflowStatusColor = (status: MediaAssetWorkflowStatus) => {
  switch (status) {
    case "queued":
      return "#833683";
    case "pending_input":
      return "#c5981c";
    case "running":
      return "#023c53";
    case "success":
      return "#275916";
    case "failed":
      return "#7d0000";
    default:
      return "#666666";
  }
};
