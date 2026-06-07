import {
  ExperimentOutlined,
  ExportOutlined,
  HomeOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type {
  ContentAsset,
  ContentAssetTag,
  ContentTagType,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Button,
  Image,
  notification,
  Progress,
  Result,
  Space,
  Spin,
  Steps,
  Typography,
} from "antd";
import { Content } from "antd/lib/layout/layout";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import prettyMilliseconds from "pretty-ms";
import React, { type ReactNode, useEffect, useState } from "react";
import contentApi from "../../../api/contentApi";
import ContentAssetRating from "../../../components/content/ContentAssetRating";
import ContentAssetSizeDisplay from "../../../components/content/ContentAssetSizeDisplay";
import ContentAssetTagInput from "../../../components/content/ContentAssetTagInput";
import ContentAssetThumbnailGrid from "../../../components/content/ContentAssetThumbnailGrid";
import ContentAuthWrapper from "../../../components/content/ContentAuthWrapper";
import Timestamp from "../../../components/data/Timestamp";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useAppSelector } from "../../../redux/hooks";
import { CONTENT_CDN_HOST } from "../../../utils/constants";
import type { NotificationType } from "../../../utils/notifications";

const ContentAssetPreviewPlayer = dynamic(
  () => import("../../../components/content/ContentAssetPreviewPlayer"),
  { ssr: false },
);

const ContentProcessingPage: React.FunctionComponent = () => {
  const router = useRouter();
  const [api, contextHolder] = notification.useNotification();

  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const [asset, setAsset] = useState<ContentAsset>();
  const [untaggedCount, setUntaggedCount] = useState(0);
  const [taggedCount, setTaggedCount] = useState(0);
  const [assetLoading, setAssetLoading] = useState<any>(true);
  const [assetError, setAssetError] = useState<any>();
  const [tags, setTags] = useState<ContentAssetTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState<any>(true);
  const [tagsError, setTagsError] = useState<any>();
  const [processedTags, setProcessedTags] = useState<any>(undefined);
  const [currentThumbIndex, setCurrentThumbIndex] = useState(1);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTags, setSelectedTags] = useState<ContentAssetTag[]>([]);

  const openNotificationWithIcon = (
    type: NotificationType,
    message: string,
    content: ReactNode,
  ) => {
    api[type]({
      message: message,
      description: content,
    });
  };

  const fetchNextAsset = async (quiet = false) => {
    if (!quiet) {
      setAssetLoading(true);
    }
    setAssetError(undefined);

    try {
      const fetchAssetResponse = await contentApi.getUntaggedAsset();
      setAsset(fetchAssetResponse.data.asset);
      setTaggedCount(fetchAssetResponse.data.tagged);
      setUntaggedCount(fetchAssetResponse.data.untagged);
    } catch (e) {
      setAssetError(e);
      openNotificationWithIcon("error", "Unable to load asset list", "Poop");
    } finally {
      setAssetLoading(false);
    }
  };

  const fetchTags = async (quiet = false) => {
    if (!quiet) {
      setTagsLoading(true);
    }
    setTagsError(undefined);

    try {
      const fetchTagsResponse = await contentApi.listTags();
      setTags(fetchTagsResponse.data.tags);
    } catch (e) {
      setTagsError(e);
      openNotificationWithIcon(
        "error",
        "Unable to load available tags",
        "Poop",
      );
    } finally {
      setTagsLoading(false);
    }
  };

  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string>("");

  const appendProgress = (text: string) => {
    setProgressText(`${progressText}\n${text}`);
  };

  const processAsset = async () => {
    setProcessing(true);
    setProgressText("Initializing...");

    for (let i = 0; i < selectedTags.length; i++) {
      const tag = selectedTags[i];

      appendProgress(
        `Applying tag [Type: ${tag.type}]: ${tag.name} to asset...`,
      );

      await contentApi.addTagToAsset(asset!.id, tag.type, tag.name);

      setProgress((i + 1 / selectedTags.length) * 100);
    }

    setProcessing(false);
  };

  useEffect(() => {
    (async () => {
      await fetchNextAsset();
      await fetchTags();
    })();
  }, []);

  useEffect(() => {
    const sortedTags: Record<ContentTagType, ContentAssetTag[]> = {
      system: [],
      model: [],
      user: [],
      source: [],
      type: [],
    };

    tags.forEach((tag) => {
      if (!Object.keys(sortedTags).includes(tag.type)) {
        return;
      }
      sortedTags[tag.type].push(tag);
    });

    Object.keys(sortedTags).forEach((key) => {
      sortedTags[key as ContentTagType].sort((a, b) => {
        const nameA = a.name.toUpperCase(); // ignore upper and lowercase
        const nameB = b.name.toUpperCase(); // ignore upper and lowercase

        return nameA === nameB ? 0 : nameA < nameB ? -1 : 1;
      });
    });

    setProcessedTags(sortedTags);
  }, [tags]);

  let playerContent = undefined;
  let content = <Spin spinning={true} />;
  let contentOffset = 0;

  if (assetError) {
    content = (
      <Result
        status="error"
        title="Unable to fetch asset"
        subTitle="Please check and modify the following information before resubmitting."
      />
    );
  }

  if (asset) {
    const aspectRatio = asset.height / asset.width;
    const rows = aspectRatio > 1 ? 2 : 4;
    const height = aspectRatio > 1 ? 200 : 75;
    const imgHeight = (height + 4) * rows + 8;
    const imgWidth = imgHeight / aspectRatio;
    const videoOrientation = aspectRatio > 1 ? "horizontal" : "vertical";

    let videoWidth, videoHeight;

    if (videoOrientation === "horizontal") {
      videoHeight = imgHeight;
      videoWidth = imgWidth;
    } else {
      videoHeight = (imgHeight - 8) / 2;
      videoWidth = videoHeight * (1 / aspectRatio);
    }

    contentOffset = rows * height + 24 + 64 + 96;

    playerContent = (
      <Space
        direction={"vertical"}
        style={{
          display: "block",
          width: "100%",
          padding: 16,
        }}
      >
        <Space
          direction={"horizontal"}
          style={{
            justifyContent: "space-between",
            alignItems: "start",
            width: "100%",
          }}
        >
          <Space orientation={"vertical"}>
            <Typography.Title level={3} style={{ marginBottom: 2 }}>
              {asset.name || asset.originalName}
            </Typography.Title>
            <Typography.Text copyable={true}>{asset.id}</Typography.Text>
            <Space orientation={"horizontal"}>
              <ContentAssetThumbnailGrid
                height={height}
                asset={asset}
                onSelect={(index: number) => {
                  setCurrentThumbIndex(index);
                }}
              />
              <Space
                style={{
                  objectFit: "contain",
                }}
              >
                <Image
                  preview={true}
                  width={imgWidth}
                  height={imgHeight}
                  src={`${CONTENT_CDN_HOST}/assets/${asset.id}/screenshots/${currentThumbIndex}.png`}
                  style={{ borderRadius: 6 }}
                />
              </Space>
              <Space
                direction={videoOrientation}
                styles={{ item: { lineHeight: 0 } }}
              >
                <ContentAssetPreviewPlayer
                  asset={asset}
                  type={"sample"}
                  maxHeight={videoHeight}
                  maxWidth={videoWidth}
                />
                <ContentAssetPreviewPlayer
                  asset={asset}
                  type={"timelapse"}
                  maxHeight={videoHeight}
                  maxWidth={videoWidth}
                />
              </Space>
            </Space>
          </Space>
          <Space orientation={"vertical"}>
            <Progress
              style={{ width: 450 }}
              percent={(taggedCount / (untaggedCount + taggedCount)) * 100}
              format={(percent: number) => {
                return `${(percent || 0).toFixed(2)}%`;
              }}
            />
            <Space
              direction={"horizontal"}
              style={{ justifyContent: "space-between" }}
            >
              <Space orientation={"horizontal"}>
                <Typography.Text style={{ fontFamily: "monospace" }}>
                  {taggedCount}
                </Typography.Text>
                <Typography.Text>of</Typography.Text>
                <Typography.Text style={{ fontFamily: "monospace" }}>
                  {untaggedCount + taggedCount}
                </Typography.Text>
              </Space>
              <Space orientation={"horizontal"}>
                <Typography.Text style={{ fontFamily: "monospace" }}>
                  {untaggedCount}
                </Typography.Text>
                <Typography.Text>remaining</Typography.Text>
              </Space>
            </Space>
            <Space orientation={"vertical"}>
              <Typography.Title level={5}>Asset Info</Typography.Title>
              <Space orientation={"horizontal"}>
                <Typography.Text strong={true}>Dimensions:</Typography.Text>
                <Typography.Text>
                  {asset.width}px x {asset.height}px
                </Typography.Text>
              </Space>
              <Space orientation={"horizontal"} style={{ alignItems: "start" }}>
                <Typography.Text strong={true}>Size:</Typography.Text>
                <ContentAssetSizeDisplay asset={asset} />
              </Space>
              <Space orientation={"horizontal"}>
                <Typography.Text strong={true}>Duration:</Typography.Text>
                <Typography.Text>
                  {asset.durationMs
                    ? prettyMilliseconds(asset.durationMs)
                    : "Unknown"}
                </Typography.Text>
              </Space>
              <Space orientation={"horizontal"}>
                <Typography.Text strong={true}>Rating:</Typography.Text>
                <ContentAssetRating asset={asset} />
              </Space>
              <Space orientation={"horizontal"}>
                <Typography.Text strong={true}>Created:</Typography.Text>
                <Timestamp
                  direction={"horizontal"}
                  value={asset.createdTime}
                  showTime={true}
                />
              </Space>
            </Space>
            <Button
              style={{ marginTop: 16 }}
              size={"middle"}
              color={"cyan"}
              variant={"solid"}
              iconPosition={"end"}
              icon={<ExportOutlined />}
              block={true}
              href={`/dionysus/content/asset/${asset.id}`}
              target={"_dionysus_asset"}
            >
              Asset Details Page
            </Button>
          </Space>
        </Space>
      </Space>
    );

    const tagStepContent = (
      <Space
        direction={"horizontal"}
        style={{ width: "100%", marginTop: 16, borderTop: "1px solid #efefef" }}
        styles={{ item: { height: `calc(100vh - ${contentOffset + 178}px)` } }}
      >
        <ContentAssetTagInput
          onChange={(tags) => {
            setSelectedTags(tags);
          }}
        />
      </Space>
    );

    const processContent = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          rowGap: 6,
          height: "100%",
          marginTop: 64,
        }}
      >
        <Typography.Title level={5}>Tagging Asset</Typography.Title>
        <Progress size={"default"} percent={progress} />
        <pre
          style={{
            border: "1px solid #efefef",
            borderRadius: 8,
            padding: 16,
            margin: 8,
            backgroundColor: "#f3f3f3",
            height: "100%",
            display: "block",
          }}
        >
          {progressText}
        </pre>
      </div>
    );

    const steps = [
      {
        key: "Load",
        title: "Load Asset",
        content: <></>,
      },
      {
        key: "Tag",
        title: "Tag Asset",
        content: tagStepContent,
      },
      {
        key: "Process",
        title: "Process",
        content: processContent,
      },
    ];

    content = (
      <>
        <div
          style={{
            padding: 16,
            width: "100%",
            overflow: "hidden",
          }}
        >
          <Steps current={currentStep} items={steps} progressDot={true} />
          {steps[currentStep].content}
        </div>
        <div
          style={{
            display: "flex",
            borderTop: "1px solid #efefef",
            width: "100%",
            padding: 8,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Space orientation={"horizontal"}>
            {currentStep < steps.length - 1 && (
              <Button
                type="primary"
                disabled={selectedTags.length <= 0}
                onClick={async () => {
                  setCurrentStep(currentStep + 1);

                  if (currentStep + 1 === steps.length - 1) {
                    await processAsset();
                  }
                }}
              >
                Apply Tags
              </Button>
            )}
            {currentStep === steps.length - 1 && (
              <Button
                type="primary"
                disabled={processing}
                onClick={async () => {
                  setProcessing(false);
                  setProgress(0);
                  setProgressText("");
                  setCurrentStep(1);
                  setCurrentThumbIndex(1);
                  setSelectedTags([]);

                  await fetchNextAsset();
                }}
              >
                {processing ? "Processing asset..." : "Move to next asset"}
              </Button>
            )}
          </Space>
        </div>
      </>
    );
  }

  return (
    <ContentAuthWrapper>
      <OlympusBreadcrumbs
        items={[
          {
            title: (
              <Link href={"/"}>
                <Space orientation={"horizontal"} size={4}>
                  <HomeOutlined />
                  <span>Home</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus"}>
                <Space orientation={"horizontal"} size={4}>
                  <HomeOutlined />
                  <span>Dionysus</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus/content"}>
                <Space orientation={"horizontal"} size={4}>
                  <ExperimentOutlined />
                  <span>Content</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus/content/assets"}>
                {" "}
                <Space orientation={"horizontal"} size={4}>
                  <VideoCameraOutlined />
                  <span>Assets</span>
                </Space>
              </Link>
            ),
          },
          {
            title: <Typography.Text>Asset Tagging</Typography.Text>,
          },
        ]}
      />
      {playerContent}
      <Content
        style={{
          background: "#fff",
        }}
      >
        <Content
          style={{
            marginTop: 32,
            position: "fixed",
            top: contentOffset + 16,
            zIndex: 10,
            borderTop: "1px solid #efefef",
            width: "100%",
            height: `calc(100vh - ${contentOffset}px - 48px)`,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              display: "flex",
              justifyContent: "space-between",
              flexDirection: "column",
            }}
          >
            {content}
          </div>
        </Content>
      </Content>
    </ContentAuthWrapper>
  );
};

export default ContentProcessingPage;
