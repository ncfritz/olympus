import type { ContentAsset } from "@ncfritz/olympus-sdk/dionysus";
import { Col, Progress, Row, Space, Typography } from "antd";
import prettyBytes from "pretty-bytes";
import React from "react";

interface ContentAssetSizeDisplayProps {
  asset: ContentAsset;
}

const ContentAssetSizeDisplay: React.FunctionComponent<
  ContentAssetSizeDisplayProps
> = ({ asset }: ContentAssetSizeDisplayProps) => {
  const growth =
    ((asset.newSizeBytes - asset.originalSizeBytes) / asset.originalSizeBytes) *
    100;

  return (
    <Space orientation={"vertical"} size={0} style={{ width: 300 }}>
      <Row>
        <Col span={24}>
          <Progress
            type={"line"}
            size={"small"}
            showInfo={true}
            format={(_percent) => {
              return `${growth.toFixed(2)}%`;
            }}
            strokeColor={growth < 0 ? "#0000cc" : "#990000"}
            percent={Math.abs(growth)}
            style={{
              marginBottom: 0,
            }}
          ></Progress>
        </Col>
      </Row>
      <Row>
        <Col span={3}>
          <Typography.Text
            style={{
              fontSize: 11,
            }}
          >
            Asset:
          </Typography.Text>
        </Col>
        <Col span={6}>
          <Typography.Text
            style={{
              fontSize: 11,
            }}
          >
            {prettyBytes(asset.newSizeBytes)}
          </Typography.Text>
        </Col>
        <Col span={4}>
          <Typography.Text
            style={{
              fontSize: 11,
            }}
          >
            Original:
          </Typography.Text>
        </Col>
        <Col span={7}>
          <Typography.Text
            style={{
              fontSize: 11,
            }}
          >
            {prettyBytes(asset.originalSizeBytes)}
          </Typography.Text>
        </Col>
      </Row>
    </Space>
  );
};
export default ContentAssetSizeDisplay;
