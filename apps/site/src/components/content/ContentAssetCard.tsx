"use client";

import { EyeOutlined, LinkOutlined } from "@ant-design/icons";
import type { ContentAsset } from "@ncfritz/olympus-sdk/dionysus";
import { Button, Card, Modal, Space, Typography } from "antd";
import dynamic from "next/dynamic";
import prettyMilliseconds from "pretty-ms";
import { type CSSProperties, useState } from "react";
import Timestamp from "../data/Timestamp";
import ContentAssetPlyr from "./ContentAssetPlyr";
import ContentAssetRating from "./ContentAssetRating";
import ContentAssetSizeDisplay from "./ContentAssetSizeDisplay";
import ContentAssetThumbnailGrid from "./ContentAssetThumbnailGrid";
import { calculateAssetDimensions } from "./util";

const ContentAssetPreviewPlayer = dynamic(
  () => import("./ContentAssetPreviewPlayer"),
  { ssr: false },
);

export interface ContentAssetCardProps {
  asset: ContentAsset;
  style?: CSSProperties;
}

const ContentAssetCard: React.FunctionComponent<ContentAssetCardProps> = ({
  asset,
  style,
}: ContentAssetCardProps) => {
  const [modelOpen, setModalOpen] = useState(false);

  const [width, height, aspectRatio, adjustment] =
    calculateAssetDimensions(asset);
  const thumbHeight = aspectRatio > 1 ? (height - 3 * 8) / 4 : (height - 8) / 2;
  const thumbWidth = thumbHeight * aspectRatio;

  const modalWidth =
    aspectRatio > 1
      ? width + (thumbHeight * 4 + 64 + 3 * 8)
      : width + (thumbWidth * 8 + 64 + 7 * 8);

  return (
    <Card
      key={`asset-${asset.id}`}
      style={style}
      styles={{ body: { padding: 8 } }}
    >
      <Space direction={"vertical"}>
        <Typography.Title level={5} style={{ marginBottom: 0 }}>
          {asset.originalName}
        </Typography.Title>
        <Space
          direction={"horizontal"}
          size={16}
          style={{ alignItems: "start" }}
          styles={{ item: { justifyContent: "stretch" } }}
        >
          <ContentAssetPreviewPlayer
            asset={asset}
            type={"sample"}
            playOnHover={true}
            maxHeight={225}
            maxWidth={400}
            onClick={() => {
              setModalOpen(true);
            }}
          />
          <Space
            direction={"horizontal"}
            style={{
              paddingRight: 16,
              borderRight: "1px solid #efefef",
            }}
          >
            <ContentAssetThumbnailGrid
              asset={asset}
              height={108}
              ratio={1}
              rows={2}
              imageCount={8}
              forceMax={true}
            />
          </Space>
          <Space direction={"vertical"} size={2}>
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
                {asset.durationMs
                  ? prettyMilliseconds(asset.durationMs)
                  : "Unknown"}
              </Typography.Text>
            </Space>
            <Space direction={"horizontal"}>
              <Typography.Text strong={true}>Rating:</Typography.Text>
              <ContentAssetRating asset={asset} />
            </Space>
            <Space direction={"horizontal"}>
              <Typography.Text strong={true}>Created:</Typography.Text>
              <Timestamp
                direction={"horizontal"}
                value={asset.createdTime}
                showTime={true}
              />
            </Space>
            <Space direction={"horizontal"}>
              <Button
                type={"primary"}
                icon={<LinkOutlined />}
                href={`/dionysus/content/asset/${asset.id}`}
              >
                Go to Asset Page
              </Button>
              <Button
                variant={"solid"}
                color={"magenta"}
                icon={<EyeOutlined />}
                onClick={() => {
                  setModalOpen(true);
                }}
              >
                View Asset
              </Button>
            </Space>
          </Space>
        </Space>
      </Space>
      <Modal
        open={modelOpen}
        width={modalWidth}
        destroyOnHidden={true}
        onCancel={() => {
          setModalOpen(false);
        }}
        footer={null}
        title={asset.originalName}
      >
        <ContentAssetPlyr asset={asset} showWarnings={false} />
      </Modal>
    </Card>
  );
};
export default ContentAssetCard;
