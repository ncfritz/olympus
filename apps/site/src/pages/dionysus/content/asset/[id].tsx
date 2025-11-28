import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExperimentOutlined,
  HomeOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type { ContentAssetTag } from "@ncfritz/olympus-sdk/dionysus";
import {
  Breadcrumb,
  Button,
  Col,
  Result,
  Row,
  Space,
  Spin,
  Typography,
} from "antd";
import { Content } from "antd/lib/layout/layout";
import Hls from "hls.js";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import type {
  APITypes,
  PlyrInstance,
  PlyrOptions,
  PlyrSource,
} from "plyr-react";
import prettyMilliseconds from "pretty-ms";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import contentApi from "../../../../api/contentApi";
import ContentAssetRating from "../../../../components/content/ContentAssetRating";
import ContentAssetSizeDisplay from "../../../../components/content/ContentAssetSizeDisplay";
import ContentAssetTagEditor from "../../../../components/content/ContentAssetTagEditor";
import ContentAssetThumbnailGrid from "../../../../components/content/ContentAssetThumbnailGrid";
import ContentAuthWrapper from "../../../../components/content/ContentAuthWrapper";
import SimilarContentAssetsScroller from "../../../../components/content/SimilarContentAssetsScroller";
import Timestamp from "../../../../components/data/Timestamp";
import { useAppSelector } from "../../../../redux/hooks";
import "react-horizontal-scrolling-menu/dist/styles.css";

const PlyrWrapper = dynamic(
  () => import("../../../../components/common/PlyrWrapper"),
  { ssr: false },
);

const ContentAssetDetailsPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const playerRef = useRef<APITypes>(null);

  const [asset, setAsset] = useState<any>();
  const [assetLoading, setAssetLoading] = useState<any>(true);
  const [assetError, setAssetError] = useState<any>();
  const [hlsEnabled, setHlsEnabled] = useState(true);
  const [thumbsGenerated, setThumbsGenerated] = useState(true);
  const [videoSource, setVideoSource] = useState<PlyrSource | undefined>(
    undefined,
  );
  const [options, setOptions] = useState<PlyrOptions | undefined>(undefined);

  const fetchAsset = async () => {
    setAssetLoading(true);
    setAssetError(undefined);

    try {
      const getAssetResponse = await contentApi.getAsset(id as string);
      setAsset(getAssetResponse.data.asset);
    } catch (e) {
      setAssetError(e);
    } finally {
      setAssetLoading(false);
    }
  };

  const getTagsOfType = (type: string): ContentAssetTag[] => {
    return asset.tags.filter((tag: ContentAssetTag) => {
      return tag.type === type;
    });
  };

  useEffect(() => {
    (async () => {
      await fetchAsset();
    })();
  }, [id, blackCurtainEnabled]);

  useLayoutEffect(() => {
    if (!asset) {
      return;
    }

    let hls = false;
    let thumbs = false;

    for (const tag of asset.tags) {
      if (tag.type === "system" && tag.name === "video.hls") {
        hls = true;
      } else if (tag.type === "system" && tag.name === "video.thumbs") {
        thumbs = true;
      }
    }

    const player = playerRef.current;
    console.log(playerRef);
    const source: PlyrSource = {
      type: "video",
      sources: [],
      poster: `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/screenshots/0.png`,
    };
    const options: PlyrOptions = {
      controls: ["play", "progress", "current-time", "volume", "mute"],
      muted: true,
      clickToPlay: true,
    };

    if (thumbs) {
      options.previewThumbnails = {
        src: `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/thumbs.vtt`,
        enabled: true,
      };
    }

    if (hls && player) {
      const hls = new Hls();
      hls.loadSource(
        `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/playlist.m3u8`,
      );
      hls.attachMedia(player);
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        (player.plyr as PlyrInstance).play();
      });
    } else {
      source.sources = [
        {
          src: `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/asset.mp4?start=0`,
          type: "video/mp4",
        },
      ];
    }

    setHlsEnabled(hls);
    setThumbsGenerated(thumbs);
    setVideoSource(source);
    setOptions(options);
  }, [asset, playerRef.current]);

  const actionRequired = !(thumbsGenerated && hlsEnabled);

  let playerContent = undefined;
  let content = <Spin spinning={true} />;
  let contentOffset = actionRequired ? 100 : 0;

  if (assetError) {
    content = (
      <Result
        status="error"
        title="Unable to fetch asset"
        subTitle="Please check and modify the following information before resubmitting."
      />
    );
  } else if (!assetLoading) {
    const minHeight = 550;
    const maxHeight = 600;
    const maxWidth = 800;

    let ratioAdjustment = 1;

    if (asset.width > maxWidth) {
      ratioAdjustment = maxWidth / asset.width;
    } else if (asset.height > maxHeight) {
      ratioAdjustment = maxHeight / asset.height;
    } else if (asset.height < minHeight) {
      ratioAdjustment = minHeight / asset.height;
    }

    contentOffset = contentOffset + Math.floor(ratioAdjustment * asset.height);

    const ssr = typeof window === "undefined" || !document;

    const assetPlayer = (
      <Space
        style={{
          margin: 16,
          backgroundColor: "#142737",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: Math.floor(ratioAdjustment * asset.width),
            height: Math.floor(ratioAdjustment * asset.height),
            display: "#000000",
          }}
        >
          {!ssr && videoSource && options && (
            <PlyrWrapper
              data-displaymaxtap={true}
              playerRef={playerRef}
              source={videoSource}
              options={options}
            />
          )}
        </div>
      </Space>
    );

    playerContent = (
      <Space
        direction={"vertical"}
        style={{
          display: "block",
          width: "calc(100vw - 200px)",
        }}
      >
        <Row
          style={{
            background: "#142737",
            display: "flex",
          }}
        >
          <Space
            style={{
              width: asset.width * ratioAdjustment + 32,
              alignItems: "start",
            }}
          >
            {assetPlayer}
          </Space>
          <Space direction={"vertical"} style={{ marginTop: 16 }}>
            <ContentAssetThumbnailGrid
              asset={asset}
              seek={(seconds: number) => {
                console.log(playerRef);
                if (playerRef?.current?.plyr) {
                  playerRef.current.plyr.currentTime = seconds;
                }
              }}
            />
          </Space>
        </Row>
        {actionRequired && (
          <Row style={{ padding: 16, background: "#ffcc33" }}>
            <Space size={16} direction={"horizontal"}>
              <Space
                size={8}
                direction={"horizontal"}
                style={{ borderRight: "1px solid #ccaa00", paddingRight: 16 }}
              >
                <Typography.Text style={{ color: "#333333", fontSize: "12px" }}>
                  HTTP Live Streaming
                </Typography.Text>
                {hlsEnabled ? (
                  <Space size={8}>
                    <CheckCircleOutlined
                      style={{ fontSize: "14px", color: "#00CC00" }}
                    />
                    <Typography.Text
                      style={{ fontSize: "14px", color: "00CC00" }}
                    >
                      Enabled
                    </Typography.Text>
                  </Space>
                ) : (
                  <Space size={16} direction={"horizontal"}>
                    <Space size={8}>
                      <CloseCircleOutlined
                        style={{ fontSize: "14px", color: "#cc0000" }}
                      />
                      <Typography.Text
                        style={{ fontSize: "14px", color: "#cc0000" }}
                      >
                        Disabled
                      </Typography.Text>
                    </Space>
                    <Button
                      ghost={true}
                      size={"small"}
                      onClick={async () => {
                        await contentApi.queueContentTask(asset.id, "hls");
                      }}
                    >
                      Enable
                    </Button>
                  </Space>
                )}
              </Space>
            </Space>
            <Space
              size={16}
              direction={"horizontal"}
              style={{ paddingLeft: 16 }}
            >
              <Space size={8} direction={"horizontal"}>
                <Typography.Text style={{ color: "#333333", fontSize: "12px" }}>
                  Thumbnails
                </Typography.Text>
                {thumbsGenerated ? (
                  <Space size={8}>
                    <CheckCircleOutlined
                      style={{ fontSize: "14px", color: "#00CC00" }}
                    />
                    <Typography.Text
                      style={{ fontSize: "14px", color: "00CC00" }}
                    >
                      Generated
                    </Typography.Text>
                  </Space>
                ) : (
                  <Space size={16} direction={"horizontal"}>
                    <Space size={8}>
                      <CloseCircleOutlined
                        style={{ fontSize: "14px", color: "#cc0000" }}
                      />
                      <Typography.Text
                        style={{ fontSize: "14px", color: "#cc0000" }}
                      >
                        Missing
                      </Typography.Text>
                    </Space>
                    <Button
                      ghost={true}
                      size={"small"}
                      onClick={async () => {
                        await contentApi.queueContentTask(
                          asset.id,
                          "thumbnail",
                        );
                      }}
                    >
                      Generate
                    </Button>
                  </Space>
                )}
              </Space>
            </Space>
          </Row>
        )}
      </Space>
    );

    content = (
      <>
        <Row gutter={16} style={{ margin: 16 }}>
          <Col span={24}>
            <Typography.Title level={2} style={{ color: "#cccccc" }}>
              {asset.name || asset.originalName}
            </Typography.Title>
          </Col>
          <Col span={9}>
            <ContentAssetTagEditor asset={asset} />
          </Col>
          <Col span={1} />
          <Col span={9} style={{ marginTop: 16 }}>
            <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
              <Typography.Text strong={true}>Info</Typography.Text>
              <Row>
                <Col span={6}>Asset Size:</Col>
                <Col span={16}>
                  <ContentAssetSizeDisplay asset={asset} />
                </Col>
              </Row>
              <Row>
                <Col span={6}>Rating:</Col>
                <Col span={16}>
                  <ContentAssetRating asset={asset} />
                </Col>
              </Row>
              <Row>
                <Col span={6}>Created:</Col>
                <Col span={16}>
                  <Timestamp value={asset.createdTime} />
                </Col>
              </Row>
              <Row>
                <Col span={6}>Duration:</Col>
                <Col span={16}>{prettyMilliseconds(asset.durationMs)}</Col>
              </Row>
              <Row>
                <Col span={6}>Dimensions:</Col>
                <Col span={16}>
                  {asset.width}px x {asset.height}px
                </Col>
              </Row>
              <Row>
                <Col span={6}>Created:</Col>
                <Col span={16}>
                  <Timestamp value={asset.createdTime} />
                </Col>
              </Row>
              <Row>
                <Col span={6}>Asset SHA256:</Col>
                <Col span={18}>
                  <Typography.Text copyable={true}>
                    {asset.newSha}
                  </Typography.Text>
                </Col>
              </Row>
              <Row>
                <Col span={6}>Original SHA256:</Col>
                <Col span={18}>
                  <Typography.Text copyable={true}>
                    {asset.originalSha}
                  </Typography.Text>
                </Col>
              </Row>
            </Space>
          </Col>
        </Row>
        <Row gutter={16} style={{ margin: 16, marginTop: 48 }}>
          <Col span={24}>
            <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
              <Typography.Text strong={true}>Similar Content</Typography.Text>
              <SimilarContentAssetsScroller
                asset={asset}
                tags={getTagsOfType("user")}
              />
            </Space>
          </Col>
        </Row>
        <Row gutter={16} style={{ margin: 16, marginTop: 16 }}>
          <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
            <Typography.Text strong={true}>More of Type</Typography.Text>
            <SimilarContentAssetsScroller
              asset={asset}
              tags={getTagsOfType("type")}
            />
          </Space>
        </Row>
        <Row gutter={16} style={{ margin: 16, marginTop: 16 }}>
          <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
            <Typography.Text strong={true}>
              More From the Same Sources
            </Typography.Text>
            <SimilarContentAssetsScroller
              asset={asset}
              tags={getTagsOfType("source")}
            />
          </Space>
        </Row>
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
            width: "calc(100vw - 200px)",
          }}
        >
          <Breadcrumb
            style={{
              padding: 8,
              paddingLeft: 16,
              background: asset ? "#142737" : "#c5c5c5",
            }}
            items={[
              {
                title: (
                  <Link
                    href={"/"}
                    style={{ color: asset ? "#c5c5c5" : "#333333" }}
                  >
                    <Space direction={"horizontal"} size={4}>
                      <HomeOutlined />
                      <span>Home</span>
                    </Space>
                  </Link>
                ),
              },
              {
                title: (
                  <Link
                    href={"/dionysus"}
                    style={{ color: asset ? "#c5c5c5" : "#333333" }}
                  >
                    <Space direction={"horizontal"} size={4}>
                      <ExperimentOutlined />
                      <span>Dionysus</span>
                    </Space>
                  </Link>
                ),
              },
              {
                title: (
                  <Link
                    href={"/dionysus/content"}
                    style={{ color: asset ? "#c5c5c5" : "#333333" }}
                  >
                    <Space direction={"horizontal"} size={4}>
                      <ExperimentOutlined />
                      <span>Content</span>
                    </Space>
                  </Link>
                ),
              },
              {
                title: (
                  <Link
                    href={"/dionysus/content/assets"}
                    style={{ color: asset ? "#c5c5c5" : "#333333" }}
                  >
                    <Space direction={"horizontal"} size={4}>
                      <VideoCameraOutlined />
                      <span>Assets</span>
                    </Space>
                  </Link>
                ),
              },
              {
                title: (
                  <Typography.Text
                    style={{ color: asset ? "#c5c5c5" : "#333333" }}
                  >
                    {id}
                  </Typography.Text>
                ),
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
              marginTop: 48,
              marginBottom: 16,
              position: "relative",
              top: contentOffset + 32,
              zIndex: 10,
            }}
          >
            {content}
          </Content>
        </Content>
      </Content>
    </ContentAuthWrapper>
  );
};

export default ContentAssetDetailsPage;
