import {
  ExperimentOutlined,
  HomeOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type { ContentAssetTag } from "@ncfritz/olympus-sdk/dionysus";
import {
  Breadcrumb,
  Col,
  Result,
  Row,
  Space,
  Spin,
  Typography,
} from "antd";
import { Content } from "antd/lib/layout/layout";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import prettyMilliseconds from "pretty-ms";
import React, { useEffect, useState } from "react";
import contentApi from "../../../../api/contentApi";
import ContentAssetRating from "../../../../components/content/ContentAssetRating";
import ContentAssetSizeDisplay from "../../../../components/content/ContentAssetSizeDisplay";
import ContentAssetTagEditor from "../../../../components/content/ContentAssetTagEditor";
import ContentAuthWrapper from "../../../../components/content/ContentAuthWrapper";
import SimilarContentAssetsScroller from "../../../../components/content/SimilarContentAssetsScroller";
import Timestamp from "../../../../components/data/Timestamp";
import { useAppSelector } from "../../../../redux/hooks";
import "react-horizontal-scrolling-menu/dist/styles.css";

const PlyrWrapper = dynamic(
  () => import("../../../../components/content/./ContentAssetPlyr"),
  { ssr: false },
);

const ContentAssetDetailsPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const [asset, setAsset] = useState<any>();
  const [assetLoading, setAssetLoading] = useState<any>(true);
  const [assetError, setAssetError] = useState<any>();
  const [hlsEnabled, setHlsEnabled] = useState(true);
  const [thumbsGenerated, setThumbsGenerated] = useState(true);

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

    let hls = false;
    let thumbs = false;

    for (const tag of asset.tags) {
      if (tag.type === "system" && tag.name === "video.hls") {
        hls = true;
      } else if (tag.type === "system" && tag.name === "video.thumbs") {
        thumbs = true;
      }
    }

    setHlsEnabled(hls);
    setThumbsGenerated(thumbs);
  }, [asset]);

  const actionRequired = !(thumbsGenerated && hlsEnabled);

  let content = <Spin spinning={true} />;
  let contentOffset = actionRequired ? 100 : 0;

  let playerContent = undefined;

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
    playerContent = (
      <PlyrWrapper
        asset={asset}
        ratioAdjustment={ratioAdjustment}
        thumbsGenerated={thumbsGenerated}
        hlsEnabled={hlsEnabled}
      />
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
