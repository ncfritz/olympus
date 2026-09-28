import { CaretRightOutlined } from "@ant-design/icons";
import type {
  MediaAssetDownload,
  DecoratedMediaAssetWorkflow,
} from "@ncfritz/olympus-sdk/dionysus";
import { Button, Collapse, Empty, Result, Space, Typography } from "antd";
import axios from "axios";
import prettyBytes from "pretty-bytes";
import React from "react";
import adminApi from "../../../../api/adminApi";
import { useFetch } from "../../../../hooks/useFetch";
import { DIONYSUS_CDN_HOST, ENVIRONMENT } from "../../../../utils/constants";
import LoadingWrapper from "../../../common/LoadingWrapper";
import RefreshTimer from "../../../common/RefreshTimer";
import Timestamp from "../../../data/Timestamp";
import SearchResultTag from "../SearchResultTag";
import { getDownloadProgressColor } from "../utils";
import { MetadataDetail, MetadataTitle } from "./common";
import { v4 as uuidv4 } from "uuid";
import StepProgress from "./StepProgress";

export interface DownloadDetailsPanelProps {
  workflow: DecoratedMediaAssetWorkflow;
  download?: MediaAssetDownload;
}

const DownloadDetailsPanel: React.FunctionComponent<
  DownloadDetailsPanelProps
> = ({ workflow, download }: DownloadDetailsPanelProps) => {
  const [nzbMetadata, nzbMetaLoading, nzbMetaError, fetchNzbMetadata] =
    useFetch<undefined, any>({
      dataType: undefined,
      params: undefined,
      watch: [workflow.id],
      fetchFunction: async () => {
        const response = await axios.get(
          `${DIONYSUS_CDN_HOST}/workflow/${workflow.id}/nzbMeta.json`,
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

  let downloadContent = <Empty description={"No download found"} />;

  if (download) {
    const color = getDownloadProgressColor(download.status);

    downloadContent = (
      <Space
        orientation={"vertical"}
        style={{ maxWidth: 950, marginBottom: 32 }}
        size={0}
      >
        {download.status === "success" && (
          <Result
            style={{ padding: 0, marginBottom: 16 }}
            status={"success"}
            title="Download Complete"
            subTitle="The Usenet download has been successfully completed."
          />
        )}
        {download.status === "failed" && (
          <Result
            style={{ padding: 0, marginBottom: 16 }}
            status={"error"}
            title="Download Failed"
            subTitle="The Usenet download has failed - the workflow may need to be re-run to complete the download."
          />
        )}
        <Space
          orientation={"horizontal"}
          size={8}
          style={{ alignItems: "center" }}
        >
          <Typography.Title
            level={5}
            style={{ marginBottom: 0, paddingBottom: 0 }}
          >
            Download Progress:
          </Typography.Title>
          <SearchResultTag
            color={color}
            monospace={true}
            style={{ maxWidth: 110, padding: 4 }}
          >
            {download.status}
          </SearchResultTag>
        </Space>
        <StepProgress step={download} />
      </Space>
    );
  }

  let nzbContent = (
    <Empty description={"NZB metadata not found"}>
      <Button onClick={() => fetchNzbMetadata(true)}>
        Refetch NZB Metadata
      </Button>
    </Empty>
  );

  if (nzbMetadata) {
    nzbContent = (
      <Space orientation={"vertical"} style={{ width: "100%" }} size={0}>
        {ENVIRONMENT === "dev" && (
          <Button
            style={{ marginBottom: 32 }}
            type="primary"
            block={true}
            danger={true}
            onClick={async () => {
              await adminApi.sendAmqpTestMessage(
                "media.trigger",
                {
                  workflowId: workflow.id,
                  mediaExtension: "mkv",
                  mediaType: "original",
                },
                "jobType.extractMetadata",
              );
            }}
          >
            Run Workflow
          </Button>
        )}
        <MetadataTitle strong={true} fontSize={16} monospace={true}>
          {nzbMetadata.meta.title}
        </MetadataTitle>
        <MetadataTitle
          strong={false}
          fontSize={14}
          style={{ color: "#666666" }}
        >
          {nzbMetadata.file.subject}
        </MetadataTitle>
        <MetadataDetail title={"Size"} monospace={true}>
          {prettyBytes(nzbMetadata.size)}
        </MetadataDetail>
        <MetadataDetail title={"PAR Size"} monospace={true}>
          {prettyBytes(nzbMetadata.parSize)}
        </MetadataDetail>
        <MetadataDetail title={"Groups"} monospace={true}>
          {nzbMetadata.groups}
        </MetadataDetail>
        <MetadataDetail title={"Posters"} monospace={true}>
          {nzbMetadata.posters}
        </MetadataDetail>
        <MetadataDetail title={"Category"} monospace={true}>
          {nzbMetadata.meta.category}
        </MetadataDetail>
        <MetadataDetail title={"Passwords"} monospace={true}>
          {nzbMetadata.meta.passwords}
        </MetadataDetail>
        <MetadataTitle
          strong={true}
          fontSize={16}
          style={{ marginTop: 16, marginBottom: 8 }}
        >
          Files:
        </MetadataTitle>
        <Collapse
          ghost={true}
          expandIcon={({ isActive }) => (
            <CaretRightOutlined rotate={isActive ? 90 : 0} />
          )}
          items={nzbMetadata.files.map((file: any) => {
            return {
              key: uuidv4(),
              label: (
                <MetadataTitle strong={false} fontSize={12} monospace={true}>
                  {file.name}
                </MetadataTitle>
              ),
              children: (
                <Space
                  orientation={"vertical"}
                  size={0}
                  style={{ marginLeft: 24, marginBottom: 8, paddingBottom: 16 }}
                  styles={{ item: { lineHeight: "13px" } }}
                >
                  <MetadataTitle
                    strong={false}
                    fontSize={12}
                    style={{ color: "#666666" }}
                  >
                    {file.subject}
                  </MetadataTitle>
                  <MetadataDetail title={"Posted"} monospace={true}>
                    <Timestamp
                      value={file.timestamp}
                      direction={"horizontal"}
                      showTime={true}
                    />
                  </MetadataDetail>
                  <MetadataDetail title={"Size"} monospace={true}>
                    {prettyBytes(file.size)}
                  </MetadataDetail>
                  <MetadataDetail title={"Groups"} monospace={true}>
                    {nzbMetadata.groups}
                  </MetadataDetail>
                  <MetadataDetail title={"Poster"} monospace={true}>
                    {file.poster}
                  </MetadataDetail>
                </Space>
              ),
            };
          })}
        />
      </Space>
    );
  }

  return (
    <Space
      orientation={"vertical"}
      style={{ width: "100%", marginTop: 16 }}
      size={16}
    >
      <RefreshTimer
        ttlMs={15000}
        showProgress={false}
        fetchFunction={async () => await fetchNzbMetadata(true)}
        disabled={nzbMetadata !== undefined}
      />
      {downloadContent}
      <LoadingWrapper
        loading={nzbMetaLoading}
        error={nzbMetaError}
        showErrorDetails={true}
      >
        {nzbContent}
      </LoadingWrapper>
    </Space>
  );
};
export default DownloadDetailsPanel;
