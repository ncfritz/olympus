import type { DecoratedMediaAssetWorkflow } from "@ncfritz/olympus-sdk/dionysus";
import { Empty, Result, Space, Typography } from "antd";
import React from "react";
import { getStepLabel } from "../utils";
import StepProgress from "./StepProgress";

export interface SummaryPanelProps {
  workflow: DecoratedMediaAssetWorkflow;
}

const SummaryPanel: React.FunctionComponent<SummaryPanelProps> = ({
  workflow,
}: SummaryPanelProps) => {
  let content = (
    <Empty description={"The workflow is not in a terminal state"}>
      Workflow status: {workflow.status}
    </Empty>
  );

  if (workflow) {
    if (workflow.status === "failed") {
      content = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"error"}
          title="Workflow Failed"
          subTitle="The workflow has failed.  Please check the logs for more information."
        />
      );
    } else if (workflow.status === "success") {
      content = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"success"}
          title="Workflow Complete"
          subTitle="The workflow completed successfully.  The media asset is now available."
        />
      );
    }
  }

  return (
    <Space
      orientation={"vertical"}
      style={{ width: "100%", marginTop: 16 }}
      size={16}
    >
      {content}
      <Space
        orientation={"vertical"}
        style={{
          display: "flex",
          alignItems: "start",
        }}
        size={8}
      >
        <Typography.Text strong={true}>Download:</Typography.Text>
        <StepProgress step={workflow.download} />
      </Space>
      {workflow.steps.map((step) => {
        return (
          <Space
            orientation={"vertical"}
            style={{
              display: "flex",
              alignItems: "start",
            }}
            size={8}
          >
            <Typography.Text strong={true}>
              {getStepLabel(step.type)}:
            </Typography.Text>
            <StepProgress step={step} />
          </Space>
        );
      })}
    </Space>
  );
};
export default SummaryPanel;
