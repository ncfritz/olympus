import { LoadingOutlined } from "@ant-design/icons";
import type {
  DecoratedMediaAssetWorkflow,
  MediaAssetWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import { Empty, Result, Space } from "antd";
import React, { useEffect, useState } from "react";
import StepProgress from "./StepProgress";

export interface UploadPanelProps {
  workflow: DecoratedMediaAssetWorkflow;
}

const UploadPanel: React.FunctionComponent<UploadPanelProps> = ({
  workflow,
}: UploadPanelProps) => {
  const [step, setStep] = useState<MediaAssetWorkflowStep | undefined>(
    undefined,
  );

  useEffect(() => {
    workflow.steps.forEach((current) => {
      if (current.type === "upload") {
        setStep(current);
        return;
      }
    });
  }, [workflow]);

  let content = <Empty description={"No upload step found"} />;

  if (step) {
    console.log(step);
    let statusContent = <></>;

    if (step.status === "failed") {
      statusContent = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"error"}
          title="Upload Failed"
          subTitle="Unable to upload the transcoded asset and metadata to the library/CDN.  Please check that the NFS hosts are operating properly."
        />
      );
    } else if (step.status === "running") {
      statusContent = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          icon={<LoadingOutlined />}
          subTitle={"Transcoded asset and metadata are being uploaded"}
        />
      );
    } else if (step.status === "success") {
      statusContent = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"success"}
          title="Assets successfully added to lobrary"
          subTitle="The transcoded asset and metadata have been uploaded to the library/CDN.  This title should now be available for streaming."
        />
      );
    }

    content = (
      <Space orientation={"vertical"} size={8}>
        {statusContent}
        <StepProgress title={"Upload"} step={step} />
      </Space>
    );
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
export default UploadPanel;
