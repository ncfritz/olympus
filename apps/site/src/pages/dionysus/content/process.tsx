import {
  ExperimentOutlined,
  HomeOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type {
  ContentAssetTag,
  ContentTagType,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Breadcrumb,
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
import Link from "next/link";
import { useRouter } from "next/router";
import prettyMilliseconds from "pretty-ms";
import React, { type ReactNode, useEffect, useState } from "react";
import contentApi from "../../../api/contentApi";
import ContentAssetPreviewPlayer from "../../../components/content/ContentAssetPreviewPlayer";
import ContentAssetRating from "../../../components/content/ContentAssetRating";
import ContentAssetSizeDisplay from "../../../components/content/ContentAssetSizeDisplay";
import ContentAssetTagSelector from "../../../components/content/ContentAssetTagSelector";
import ContentAssetThumbnailGrid from "../../../components/content/ContentAssetThumbnailGrid";
import ContentAuthWrapper from "../../../components/content/ContentAuthWrapper";
import { useAppSelector } from "../../../redux/hooks";
import type { NotificationType } from "../../../utils/notifications";

const ContentProcessingPage: React.FunctionComponent = () => {
  const router = useRouter();
  const [api, contextHolder] = notification.useNotification();

  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const [asset, setAsset] = useState<any>();
  const [untaggedCount, setUntaggedCount] = useState(0);
  const [taggedCount, setTaggedCount] = useState(0);
  const [assetLoading, setAssetLoading] = useState<any>(true);
  const [assetError, setAssetError] = useState<any>();
  const [tags, setTags] = useState<ContentAssetTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState<any>(true);
  const [tagsError, setTagsError] = useState<any>();
  const [processedTags, setProcessedTags] = useState<any>(undefined);
  const [currentThumbIndex, setCurrentThumbIndex] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);
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
  const [processingComplete, setProcessingComplete] = useState(false);
  const [progressText, setProgressText] = useState<string[]>([]);

  const appendProgress = (text: string) => {
    setProgressText([...progressText, `${text}\n`]);
  };

  const processAsset = async () => {
    setProcessing(true);
    appendProgress("Initializing...");

    for (let i = 0; i < selectedTags.length; i++) {
      const tag = selectedTags[i];

      await contentApi.addTagToAsset(asset.id, tag.type, tag.name);
      setProgress((i + 1 / selectedTags.length) * 100);
      setProcessing(false);
      setProcessingComplete(true);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchNextAsset();
      await fetchTags();
    })();
  }, [blackCurtainEnabled]);

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

    const minHeight = 550;
    const maxHeight = 600;
    const maxWidth = 800;

    let ratioAdjustment = 1;

    if (asset.width > maxWidth && videoOrientation === "vertical") {
      ratioAdjustment = maxWidth / asset.width;
    } else if (asset.height > maxHeight) {
      ratioAdjustment = maxHeight / asset.height;
    } else if (asset.height < minHeight) {
      ratioAdjustment = minHeight / asset.height;
    }

    contentOffset =
      contentOffset + Math.floor(ratioAdjustment * asset.height) + 64;

    let videoWidth, videoHeight;

    console.group(`Asset Display - ${asset.id}`);
    console.log(`Image (W x H): ${imgWidth}px x ${imgHeight}px`);
    console.log(`Aspect ratio: ${aspectRatio}`);
    console.log(`Content offset: ${contentOffset}px`);
    console.groupEnd();

    if (videoOrientation === "horizontal") {
      videoHeight = imgHeight;
      videoWidth = imgWidth;
    } else {
      videoHeight = (imgHeight - 8) / 2;
      videoWidth = videoHeight * (1 / aspectRatio);
    }

    console.log(videoOrientation);

    playerContent = (
      <Space
        direction={"vertical"}
        style={{
          display: "block",
          width: "calc(100vw - 380px)",
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
          <Space direction={"vertical"}>
            <Typography.Title level={3} style={{ marginBottom: 2 }}>
              {asset.name || asset.originalName}
            </Typography.Title>
            <Typography.Text copyable={true}>{asset.id}</Typography.Text>
            <Space direction={"horizontal"}>
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
                  src={`https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/screenshots/${currentThumbIndex}.png`}
                />
              </Space>
              <Space direction={videoOrientation}>
                <ContentAssetPreviewPlayer
                  assetId={asset.id}
                  type={"sample"}
                  height={videoHeight}
                  width={videoWidth}
                />
                <ContentAssetPreviewPlayer
                  assetId={asset.id}
                  type={"timelapse"}
                  height={videoHeight}
                  width={videoWidth}
                />
              </Space>
            </Space>
          </Space>
          <Space direction={"vertical"}>
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
              <Space direction={"horizontal"}>
                <Typography.Text style={{ fontFamily: "monospace" }}>
                  {taggedCount}
                </Typography.Text>
                <Typography.Text>of</Typography.Text>
                <Typography.Text style={{ fontFamily: "monospace" }}>
                  {untaggedCount + taggedCount}
                </Typography.Text>
              </Space>
              <Space direction={"horizontal"}>
                <Typography.Text style={{ fontFamily: "monospace" }}>
                  {untaggedCount}
                </Typography.Text>
                <Typography.Text>remaining</Typography.Text>
              </Space>
            </Space>
            <Space direction={"vertical"}>
              <Typography.Title level={5}>Asset Info</Typography.Title>
              <Space direction={"horizontal"}>
                <Typography.Text strong={true}>Dimensions:</Typography.Text>
                <Typography.Text>
                  {asset.width}px x {asset.height}px
                </Typography.Text>
              </Space>
              <Space direction={"horizontal"} style={{ alignItems: "start" }}>
                <Typography.Text strong={true}>Size:</Typography.Text>
                <ContentAssetSizeDisplay asset={asset} />
              </Space>
              <Space direction={"horizontal"}>
                <Typography.Text strong={true}>Duration:</Typography.Text>
                <Typography.Text>
                  {asset.duration
                    ? prettyMilliseconds(asset.duration)
                    : "Unknown"}
                </Typography.Text>
              </Space>
              <Space direction={"horizontal"}>
                <Typography.Text strong={true}>Rating:</Typography.Text>
                <ContentAssetRating asset={asset} />
              </Space>
            </Space>
          </Space>
        </Space>
      </Space>
    );

    const tagStepContent = (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          rowGap: 6,
          height: "100%",
        }}
      >
        {Object.keys(processedTags).map((key) => {
          return (
            <ContentAssetTagSelector
              key={`cats-${key}`}
              title={key.charAt(0).toUpperCase() + key.slice(1)}
              type={key as ContentTagType}
              tags={processedTags[key]}
              allowAdd={true}
              allowFilter={true}
              onSelectTag={async (tag) => {
                if (!selectedTags.includes(tag)) {
                  setSelectedTags([...selectedTags, tag]);
                }
              }}
              afterAdd={async (tag) => {
                await fetchTags(true);
              }}
            />
          );
        })}
        <div style={{ paddingLeft: 32 }}>
          <ContentAssetTagSelector
            title={"Selected"}
            type={"selected"}
            tags={selectedTags}
            onRemove={async (tag) => {
              setSelectedTags(
                selectedTags.filter((current) => {
                  return tag.id !== current.id;
                }),
              );
            }}
          />
        </div>
      </div>
    );

    const detailsContent = (
      <div
        style={{
          display: "flex",
          flexGrow: 1,
          flexDirection: "column",
          height: "100%",
        }}
      >
        <ContentAssetSizeDisplay asset={asset} />
      </div>
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
        key: "Tag",
        title: "Tag Asset",
        content: tagStepContent,
      },
      {
        key: "Review",
        title: "Review Details",
        content: detailsContent,
      },
      {
        key: "Process",
        title: "Process",
        content: processContent,
      },
    ];

    content = (
      <>
        <div style={{ padding: 16, width: "100%", overflow: "hidden" }}>
          <Steps current={currentStep} items={steps} />
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
          <Space direction={"horizontal"}>
            {currentStep > 0 && !processing && !processingComplete && (
              <Button
                disabled={currentStep >= steps.length - 1}
                onClick={() => {
                  setCurrentStep(currentStep - 1);
                }}
              >
                Previous
              </Button>
            )}
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
                Next
              </Button>
            )}
            {currentStep === steps.length - 1 && (
              <Button
                type="primary"
                disabled={processing}
                onClick={async () => {
                  setProcessingComplete(false);
                  setProcessing(false);
                  setProgress(0);
                  setCurrentStep(0);
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
      <Content>
        <Content
          style={{
            position: "fixed",
            display: "block",
            height: Math.floor(contentOffset),
            top: 64,
            zIndex: 100,
            width: "calc(100vw - 380px)",
          }}
        >
          <Breadcrumb
            style={{
              padding: 8,
              paddingLeft: 16,
              background: "#f6f6f6",
            }}
            items={[
              {
                title: (
                  <Link href={"/"}>
                    <Space direction={"horizontal"} size={4}>
                      <HomeOutlined />
                      <span>Home</span>
                    </Space>
                  </Link>
                ),
              },
              {
                title: (
                  <Link href={"/dionysus"}>
                    <Space direction={"horizontal"} size={4}>
                      <HomeOutlined />
                      <span>Dionysus</span>
                    </Space>
                  </Link>
                ),
              },
              {
                title: (
                  <Link href={"/dionysus/content"}>
                    <Space direction={"horizontal"} size={4}>
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
                    <Space direction={"horizontal"} size={4}>
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
        </Content>
        <Content
          style={{
            background: "#fff",
          }}
        >
          <Content
            style={{
              marginTop: 32,
              position: "fixed",
              top: contentOffset,
              zIndex: 10,
              borderTop: "1px solid #efefef",
              width: "calc(100vw - 380px)",
              height: `calc(100vh - ${contentOffset}px - 44px)`,
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
      </Content>
    </ContentAuthWrapper>
  );
};

export default ContentProcessingPage;
