import { CaretRightOutlined } from "@ant-design/icons";
import type {
  MediaAssetDownload,
  MediaAssetWorkflow,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Button,
  Col,
  Collapse,
  Empty,
  Progress,
  Row,
  Space,
  Typography,
} from "antd";
import axios from "axios";
import { DateTime } from "luxon";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import React from "react";
import adminApi from "../../../../api/adminApi";
import { useFetch } from "../../../../hooks/useFetch";
import LoadingWrapper from "../../../common/LoadingWrapper";
import RefreshTimer from "../../../common/RefreshTimer";
import Timestamp from "../../../data/Timestamp";
import SearchResultTag from "../SearchResultTag";
import { getDownloadProgressColor, getDownloadProgressLabel } from "../utils";
import { MetadataDetail, MetadataTitle } from "./common";
import { v4 as uuidv4 } from "uuid";
import StepProgress from "./StepProgress";

export interface DownloadDetailsPanelProps {
  workflow: MediaAssetWorkflow;
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
          `https://dionysus-cdn.dev.ncfritz.net/workflow/${workflow.id}/nzbMeta.json`,
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
    const progressStatus = getDownloadProgressLabel(download.status);

    let elapsedTime = "Unknown";
    let remainingTime = "Unknown";

    if (download.finishedTime) {
      const startedTime = DateTime.fromISO(download.startedTime!);
      const finishedTime = DateTime.fromISO(download.finishedTime);

      elapsedTime = prettyMilliseconds(
        Math.abs(finishedTime.diff(startedTime, "milliseconds").milliseconds),
      );
      remainingTime = prettyMilliseconds(0);
    } else if (download.startedTime) {
      const startedTime = DateTime.fromISO(download.startedTime);
      const elapsedMs = Math.abs(
        startedTime.diffNow("milliseconds").milliseconds,
      );
      elapsedTime = prettyMilliseconds(elapsedMs);
      remainingTime = prettyMilliseconds(
        ((100 - download.progress) / download.progress) * elapsedMs,
      );
    }

    downloadContent = (
      <Space
        direction={"vertical"}
        style={{ maxWidth: 950, marginBottom: 32 }}
        size={0}
      >
        <Space
          direction={"horizontal"}
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
      <Space direction={"vertical"} style={{ width: "100%" }} size={0}>
        <Button
          style={{ marginBottom: 32 }}
          type="primary"
          block={true}
          danger={true}
          onClick={async () => {
            const suffix = nzbMetadata.file.name.split(".").pop();

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
                  direction={"vertical"}
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
      direction={"vertical"}
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
