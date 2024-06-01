import "plyr-react/plyr.css";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExperimentOutlined,
  HomeOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
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
import Link from "next/link";
import { useRouter } from "next/router";
import Plyr from "plyr";
import prettyMilliseconds from "pretty-ms";
import React, { useEffect, useRef, useState } from "react";
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
import type { ContentAssetTag } from "../assets";

const ContentAssetDetailsPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const playerRef = useRef<any>(null);

  const [asset, setAsset] = useState<any>();
  const [assetLoading, setAssetLoading] = useState<any>(true);
  const [assetError, setAssetError] = useState<any>();
  const [hlsEnabled, setHlsEnabled] = useState(false);
  const [thumbsGenerated, setThumbsGenerated] = useState(false);

  const videoSource: Plyr.SourceInfo = {
    type: "video",
    sources: [],
  };
  const playerOptions: Plyr.Options = {
    controls: ["play", "progress", "current-time", "volume", "mute"],
    muted: true,
    clickToPlay: true,
  };

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

  useEffect(() => {
    if (!asset) {
      return;
    }

    for (const tag of asset.tags) {
      if (tag.type === "system" && tag.name === "video.hls") {
        setHlsEnabled(true);
      } else if (tag.type === "system" && tag.name === "video.thumbs") {
        setThumbsGenerated(true);
      }
    }

    const player = playerRef.current!;
    videoSource.poster = `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/screenshots/0.png`;
    playerOptions.previewThumbnails = {
      src: `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/thumbs.vtt`,
      enabled: true,
    };

    if (hlsEnabled) {
      const hls = new Hls();
      const plyr = new Plyr(player, playerOptions);
      plyr.source = videoSource;

      hls.loadSource(
        `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/playlist.m3u8`,
      );
      hls.attachMedia(player);
    } else {
      videoSource.sources = [
        {
          src: `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/asset.mp4?start=0`,
          type: "video/mp4",
        },
      ];
      const plyr = new Plyr(player, playerOptions);
      plyr.source = videoSource;
    }
  }, [asset]);

  const actionRquired = !(thumbsGenerated && hlsEnabled);

  let playerContent = undefined;
  let content = <Spin spinning={true} />;
  let contentOffset = actionRquired ? 100 : 0;

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
          <video data-displaymaxtap={true} ref={playerRef} />
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
          <Space style={{ width: asset.width * ratioAdjustment + 32 }}>
            {assetPlayer}
          </Space>
          <Space direction={"vertical"} style={{ marginTop: 16 }}>
            <ContentAssetThumbnailGrid
              asset={asset}
              seek={(seconds: number) => {
                if (
                  playerRef !== null &&
                  playerRef.current !== null &&
                  playerRef.current.plyr !== null
                ) {
                  playerRef.current.plyr.currentTime = seconds;
                }
              }}
            />
          </Space>
        </Row>
        {actionRquired && (
          <Row style={{ padding: 16, background: "#ffcc33", height: 100 }}>
            <Space size={16} direction={"horizontal"}>
              <Space
                size={8}
                direction={"vertical"}
                style={{ borderRight: "1px solid #ccaa00", paddingRight: 16 }}
              >
                <Typography.Text style={{ color: "#333333", fontSize: "12px" }}>
                  HTTP Live Streaming
                </Typography.Text>
                {hlsEnabled ? (
                  <Space size={8}>
                    <CheckCircleOutlined
                      style={{ fontSize: "20px", color: "#00CC00" }}
                    />
                    <Typography.Text
                      style={{ fontSize: "20px", color: "00CC00" }}
                    >
                      Enabled
                    </Typography.Text>
                  </Space>
                ) : (
                  <Space size={16} direction={"horizontal"}>
                    <Space size={8}>
                      <CloseCircleOutlined
                        style={{ fontSize: "20px", color: "#cc0000" }}
                      />
                      <Typography.Text
                        style={{ fontSize: "20px", color: "#cc0000" }}
                      >
                        Disabled
                      </Typography.Text>
                    </Space>
                    <Button
                      ghost={true}
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
              <Space size={8} direction={"vertical"}>
                <Typography.Text style={{ color: "#333333", fontSize: "12px" }}>
                  Thumbnails
                </Typography.Text>
                {thumbsGenerated ? (
                  <Space size={8}>
                    <CheckCircleOutlined
                      style={{ fontSize: "20px", color: "#00CC00" }}
                    />
                    <Typography.Text
                      style={{ fontSize: "20px", color: "00CC00" }}
                    >
                      Generated
                    </Typography.Text>
                  </Space>
                ) : (
                  <Space size={16} direction={"horizontal"}>
                    <Space size={8}>
                      <CloseCircleOutlined
                        style={{ fontSize: "20px", color: "#cc0000" }}
                      />
                      <Typography.Text
                        style={{ fontSize: "20px", color: "#cc0000" }}
                      >
                        Missing
                      </Typography.Text>
                    </Space>
                    <Button
                      ghost={true}
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
                    href={"/content"}
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
                href: "/content/assets",
                title: (
                  <Link
                    href={"/content/assets"}
                    style={{ color: asset ? "#c5c5c5" : "#333333" }}
                  >
                    {" "}
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
