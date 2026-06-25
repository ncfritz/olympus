import { LoadingOutlined } from "@ant-design/icons";
import type {
  MediaAssetWorkflow,
  MediaAssetWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import { Empty, Result, Space } from "antd";
import axios from "axios";
import React, { useEffect, useState } from "react";
import { useFetch } from "../../../../hooks/useFetch";
import { DIONYSUS_CDN_HOST } from "../../../../utils/constants";
import LoadingWrapper from "../../../common/LoadingWrapper";
import MediaAssetDetails from "../../../content/MediaAssetDetails";

export interface MetadataDetailsPanelProps {
  workflow: MediaAssetWorkflow;
  metadataStepType: "extract_original_metadata" | "extract_new_metadata";
}

const MetadataDetailsPanel: React.FunctionComponent<
  MetadataDetailsPanelProps
> = ({ workflow, metadataStepType }: MetadataDetailsPanelProps) => {
  const [step, setStep] = useState<MediaAssetWorkflowStep | undefined>(
    undefined,
  );

  const [mediaMetadata, mediaMetaLoading, mediaMetaError] = useFetch<
    undefined,
    any
  >({
    dataType: undefined,
    params: undefined,
    watch: [workflow.id],
    fetchFunction: async () => {
      const metadataFileName =
        metadataStepType === "extract_original_metadata"
          ? "original.json"
          : "metadata.json";
      const response = await axios.get(
        `${DIONYSUS_CDN_HOST}/workflow/${workflow.id}/${metadataFileName}`,
        {
          validateStatus: (status) => status === 200 || status === 404,
        },
      );

      if (response.status === 404) {
        return undefined;
      }

      return response.data;
    },
  });

  useEffect(() => {
    workflow.steps.forEach((current) => {
      if (current.type === metadataStepType) {
        setStep(current);
        return;
      }
    });
  }, [workflow]);

  let content = <Empty description={"Original metadata not found"} />;

  if (step) {
    if (step.status === "failed") {
      content = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"error"}
          title="Metadata Extraction Failed"
          subTitle="Unable to extract the media metadata.  This may mean that ffmpeg or Handbrake could not extract the metadata due to an invalid or corrupted media file"
        />
      );
    } else if (step.status === "running") {
      content = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          icon={<LoadingOutlined />}
          subTitle={"Metadata is being extracted from the media file."}
        />
      );
    } else if (step.status === "success" && mediaMetadata) {
      content = (
        <>
          <Result
            style={{ padding: 0, marginBottom: 16 }}
            status={"success"}
            title="Metadata Extraction Complete"
            subTitle="Metadata has been successfully extracted from the media file.  The following metadata has been extracted from the media file."
          />
          <MediaAssetDetails metadata={mediaMetadata} showRaw={false} />
        </>
      );
    }
  }

  return (
    <LoadingWrapper loading={mediaMetaLoading} error={mediaMetaError}>
      <Space
        orientation={"vertical"}
        style={{ width: 950, minWidth: 650, marginTop: 16 }}
      >
        {content}
      </Space>
    </LoadingWrapper>
  );
};
export default MetadataDetailsPanel;
