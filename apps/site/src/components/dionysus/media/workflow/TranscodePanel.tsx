import { LoadingOutlined } from "@ant-design/icons";
import type {
  MediaAssetWorkflow,
  MediaAssetWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import { Empty, Result, Space } from "antd";
import React, { useEffect, useState } from "react";
import StepProgress from "./StepProgress";

export interface TranscodePanelProps {
  workflow: MediaAssetWorkflow;
}

const TranscodePanel: React.FunctionComponent<TranscodePanelProps> = ({
  workflow,
}: TranscodePanelProps) => {
  const [step, setStep] = useState<MediaAssetWorkflowStep | undefined>(
    undefined,
  );

  useEffect(() => {
    workflow.steps.forEach((current) => {
      if (current.type === "transcode") {
        setStep(current);
        return;
      }
    });
  }, [workflow]);

  let content = <Empty description={"No transcode artifacts present"} />;

  if (step) {
    console.log(step);
    let statusContent = <></>;

    if (step.status === "failed") {
      statusContent = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"error"}
          title="Transcode Failed"
          subTitle="The source file could not be transcoded.  This may be due to an invalid or corrupted source file."
        />
      );
    } else if (step.status === "running") {
      statusContent = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          icon={<LoadingOutlined />}
          subTitle={"The source asset is being transcoded"}
        />
      );
    } else if (step.status === "success") {
      statusContent = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"success"}
          title="Transcode Configuration Verified"
          subTitle="The ranscode configuration has been successfully verified and approved for transcoding."
        />
      );
    }

    const downloadSourceStep = step.subSteps.find(
      (s) => s.type === "transfer_source",
    );
    content = (
      <Space orientation={"vertical"} size={8}>
        {statusContent}
        {downloadSourceStep && [
          <StepProgress title={"Download Source"} step={downloadSourceStep} />,
          <StepProgress title={"Transcode"} step={step} />,
        ]}
      </Space>
    );
  }

  return (
    <Space
      direction={"vertical"}
      style={{ width: "100%", marginTop: 16 }}
      size={16}
    >
      {content}
    </Space>
  );
};
export default TranscodePanel;
