import { LoadingOutlined } from "@ant-design/icons";
import type {
  MediaAssetWorkflow,
  MediaAssetWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import { Button, Col, Empty, Result, Row, Space, Typography } from "antd";
import dynamic from "next/dynamic";
import React, { useEffect, useState } from "react";
import mediaApi from "../../../../api/mediaApi";
import StepProgress from "./StepProgress";

const MediaAssetPreviewPlayer = dynamic(
  () => import("./MediaAssetPreviewPlayer"),
  { ssr: false },
);

export interface VerifyConfigurationPanelProps {
  workflow: MediaAssetWorkflow;
}

const VerifyConfigurationPanel: React.FunctionComponent<
  VerifyConfigurationPanelProps
> = ({ workflow }: VerifyConfigurationPanelProps) => {
  const [step, setStep] = useState<MediaAssetWorkflowStep | undefined>(
    undefined,
  );

  useEffect(() => {
    workflow.steps.forEach((current) => {
      if (current.type === "verify_transcode") {
        setStep(current);
        return;
      }
    });
  }, [workflow]);

  let content = (
    <Empty description={"No transcode verification artifacts present"} />
  );

  if (step) {
    if (step.status === "failed") {
      content = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"error"}
          title="Transcode Configuration Verification Failed"
          subTitle="Unable to complete verification of the transcode configuration.  It is possible that subtitle extraction failed or the transcode of sample artifacts failed."
        />
      );
    } else if (step.status === "pending") {
      content = (
        <Space orientation={"vertical"} size={8}>
          <Result
            style={{ padding: 0, marginBottom: 16 }}
            status={"info"}
            subTitle={
              "Verify the transcode configuration is producing desired results before approving the configuration for transcoding"
            }
          >
            <Button
              block={true}
              type={"primary"}
              onClick={async () => {
                await mediaApi.verifyMediaAssetTranscodeConfiguration(
                  workflow.id,
                  step.id,
                );
              }}
            >
              Start Transcode
            </Button>
          </Result>
          <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
            {[...Array(6).keys()].map((i) => {
              return (
                <Col span={12}>
                  <MediaAssetPreviewPlayer
                    workflowId={workflow.id}
                    sampleIndex={i}
                    maxWidth={462}
                  />
                </Col>
              );
            })}
          </Row>
        </Space>
      );
    } else if (step.status === "running") {
      const downloadSourceStep = step.subSteps.find(
        (s) => s.type === "transfer_source",
      );
      const extractSrtStep = step.subSteps.find(
        (s) => s.type === "extract_srt",
      );
      const samples = [...Array(6).keys()].map((i) =>
        step.subSteps.find((s) => s.type === `sample_${i}`),
      );
      const uploadArtifactsStep = step.subSteps.find(
        (s) => s.type === "upload_artifacts",
      );

      content = (
        <Space orientation={"vertical"} size={8}>
          <Result
            style={{ padding: 0, marginBottom: 16 }}
            icon={<LoadingOutlined />}
            subTitle={
              "Transcode samples are being generated and uploaded to the CDN for review"
            }
          />
          {downloadSourceStep && (
            <StepProgress title={"Download Source"} step={downloadSourceStep} />
          )}
          {extractSrtStep && (
            <StepProgress title={"Extract Subtitles"} step={extractSrtStep} />
          )}
          <Typography.Text style={{ fontSize: "16px", fontWeight: "bold" }}>
            Generate Samples
          </Typography.Text>
          <Space orientation={"vertical"} size={0}>
            {samples.map((sample, index) => {
              return (
                <Space
                  direction={"horizontal"}
                  size={8}
                  style={{
                    width: "100%",
                    alignItems: "baseline",
                    display: "flex",
                  }}
                  className={"episode-fix"}
                >
                  <Typography.Text
                    style={{
                      fontSize: "13px",
                      display: "inline-block",
                      textAlign: "right",
                      width: 80,
                    }}
                  >
                    Sample {index}
                  </Typography.Text>
                  <StepProgress
                    step={sample}
                    showTiming={false}
                    width={950 - 90}
                  />
                </Space>
              );
            })}
          </Space>
          <StepProgress title={"Upload Artifacts"} step={uploadArtifactsStep} />
        </Space>
      );
    } else if (step.status === "skipped") {
      content = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"info"}
          title="Transcode Configuration Skipped"
          subTitle="The transcode configuration has been skipped.  This means the video and audio streams have been automatically selected and no subtitles need to be configured."
        />
      );
    } else if (step.status === "success") {
      content = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"success"}
          title="Transcode Configuration Verified"
          subTitle="The ranscode configuration has been successfully verified and approved for transcoding."
        />
      );
    }
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
export default VerifyConfigurationPanel;
