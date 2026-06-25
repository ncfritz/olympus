import { HomeOutlined, LoadingOutlined } from "@ant-design/icons";
import type { MediaAssetWorkflow } from "@ncfritz/olympus-sdk/dionysus";
import { Empty, Space, Steps } from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import mediaApi from "../../../api/mediaApi";
import LoadingWrapper from "../../../components/common/LoadingWrapper";
import RefreshTimer from "../../../components/common/RefreshTimer";
import {
  getDownloadStepProperties,
  getStepProperties,
} from "../../../components/dionysus/media/utils";
import CleanupPanel from "../../../components/dionysus/media/workflow/CleanupPanel";
import ConfigureTranscodePanel from "../../../components/dionysus/media/workflow/ConfigureTranscodePanel";
import DownloadDetailsPanel from "../../../components/dionysus/media/workflow/DownloadDetailsPanel";
import MetadataDetailsPanel from "../../../components/dionysus/media/workflow/MetadataDetailsPanel";
import MovieHeader from "../../../components/dionysus/media/workflow/MovieHeader";
import TranscodePanel from "../../../components/dionysus/media/workflow/TranscodePanel";
import UploadPanel from "../../../components/dionysus/media/workflow/UploadPanel";
import VerifyConfigurationPanel from "../../../components/dionysus/media/workflow/VerifyConfigurationPanel";
import TvEpisodeHeader from "../../../components/dionysus/media/workflow/TvEpisodeHeader";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { CertificationOutlined } from "../../../icons";

const IndexPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const [current, setCurrent] = useState(0);

  const [workflow, workflowLoading, workflowError, fetchWorkflow] = useFetch<
    string,
    MediaAssetWorkflow
  >({
    dataType: "Media workflow",
    watch: [id],
    params: id as string,
    fetchFunction: async (o) =>
      (await mediaApi.describeMediaAssetWorkflow(o)).data.workflow,
  });

  const onChange = (value: number) => {
    setCurrent(value);
  };

  let panelContent = <></>;
  let content = <></>;
  let headerContent = <Empty />;

  if (workflow) {
    if (current === 0) {
      panelContent = (
        <DownloadDetailsPanel
          workflow={workflow}
          download={workflow?.download}
        />
      );
    } else if (current === 1) {
      panelContent = (
        <MetadataDetailsPanel
          workflow={workflow}
          metadataStepType={"extract_original_metadata"}
        />
      );
    } else if (current === 2) {
      panelContent = <ConfigureTranscodePanel workflow={workflow} />;
    } else if (current === 3) {
      panelContent = <VerifyConfigurationPanel workflow={workflow} />;
    } else if (current === 4) {
      panelContent = <TranscodePanel workflow={workflow} />;
    } else if (current === 5) {
      panelContent = (
        <MetadataDetailsPanel
          workflow={workflow}
          metadataStepType={"extract_new_metadata"}
        />
      );
    } else if (current === 6) {
      panelContent = <UploadPanel workflow={workflow} />;
    } else if (current === 7) {
      panelContent = <CleanupPanel workflow={workflow} />;
    }

    if (workflow.type === "movie") {
      headerContent = <MovieHeader movieId={workflow.mediaId} />;
    } else {
      headerContent = <TvEpisodeHeader episodeId={workflow.mediaId} />;
    }

    content = (
      <Space
        orientation={"vertical"}
        size={0}
        style={{ width: "100%", position: "relative" }}
        styles={{ item: { width: "100%" } }}
      >
        {headerContent}
        <RefreshTimer
          ttlMs={10000}
          fetchFunction={async () => await fetchWorkflow(true)}
          showProgress={true}
        />
        <Space
          orientation={"horizontal"}
          className={"person-fix"}
          size={32}
          style={{
            maxWidth: 1280,
            display: "flex",
            alignItems: "start",
          }}
        >
          <Space
            orientation={"vertical"}
            size={16}
            style={{ marginLeft: 32, paddingTop: 16, width: 275 }}
          >
            <Steps
              current={current}
              onChange={onChange}
              orientation="vertical"
              className={"dionysus-workflow"}
              size={"small"}
              items={[
                {
                  title: "Download",
                  content: "Fetch source from Usenet",
                  ...getDownloadStepProperties(workflow.download),
                },
                {
                  title: "Original Metadata",
                  content: "Extract original metadata",
                  ...getStepProperties(
                    workflow.steps,
                    "extract_original_metadata",
                  ),
                },
                {
                  title: "Configure Transcode",
                  content: "Determine audio/subtitle tracks",
                  ...getStepProperties(workflow.steps, "configure_transcode"),
                },
                {
                  title: "Verify Configuration",
                  content: "Verify audio/subtitle config",
                  ...getStepProperties(workflow.steps, "verify_transcode"),
                },
                {
                  title: "Transcode",
                  content: "Transcode source",
                  ...getStepProperties(workflow.steps, "transcode"),
                },
                {
                  title: "New Metadata",
                  content: "Extract transcode metadata",
                  ...getStepProperties(workflow.steps, "extract_new_metadata"),
                },
                {
                  title: "Upload to Library",
                  ...getStepProperties(workflow.steps, "upload"),
                },
                {
                  title: "Cleanup",
                  ...getStepProperties(workflow.steps, "cleanup"),
                },
              ]}
            />
          </Space>
          <Space
            orientation={"vertical"}
            size={0}
            style={{
              marginLeft: 32,
              width: "100%",
              height: "calc(100vh - 305px)",
              overflowY: "scroll",
              scrollbarWidth: "none",
            }}
          >
            {panelContent}
          </Space>
        </Space>
      </Space>
    );
  } else {
    content = <Empty description={"Workflow does not exist..."} />;
  }

  return (
    <>
      <OlympusBreadcrumbs
        className={"dark"}
        items={[
          {
            title: (
              <Link href={"/"}>
                <Space size={4}>
                  <HomeOutlined />
                  <span>Home</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus"}>
                <Space size={4}>
                  <HomeOutlined />
                  <span>Dionysus</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus/queue"}>
                <Space size={4}>
                  <HomeOutlined />
                  <span>Processing Queue</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space>
                {workflowLoading ? (
                  <LoadingOutlined />
                ) : (
                  <CertificationOutlined />
                )}
                <span>{workflowLoading ? "Loading..." : workflow?.id}</span>
              </Space>
            ),
          },
        ]}
      />
      <LoadingWrapper loading={workflowLoading} error={workflowError}>
        {content}
      </LoadingWrapper>
    </>
  );
};

export default IndexPage;
