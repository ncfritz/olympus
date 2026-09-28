import { LoadingOutlined } from "@ant-design/icons";
import type {
  DecoratedMediaAssetWorkflow,
  MediaAssetWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import { Empty, Result, Space } from "antd";
import React, { useEffect, useState } from "react";
import StepProgress from "./StepProgress";

export interface CleanupPanelProps {
  workflow: DecoratedMediaAssetWorkflow;
}

const CleanupPanel: React.FunctionComponent<CleanupPanelProps> = ({
  workflow,
}: CleanupPanelProps) => {
  const [step, setStep] = useState<MediaAssetWorkflowStep | undefined>(
    undefined,
  );

  useEffect(() => {
    workflow.steps.forEach((current) => {
      if (current.type === "cleanup") {
        setStep(current);
        return;
      }
    });
  }, [workflow]);

  let content = <Empty description={"No cleanup info present"} />;

  if (step) {
    if (step.status === "failed") {
      content = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"error"}
          title="Cleanup Failed"
          subTitle="The source file and artifacts could not be cleaned up.  Please complete cleanup manually."
        />
      );
    } else if (step.status === "running") {
      content = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          icon={<LoadingOutlined />}
          subTitle={"The source file and artifacts are being cleaned up. "}
        />
      );
    } else if (step.status === "success") {
      content = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"success"}
          title="Cleanup Complete"
          subTitle="The source file and artifacts have been successfully cleaned up."
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
    </Space>
  );
};
export default CleanupPanel;
