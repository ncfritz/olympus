import { Col, QRCode, Row, Space, Typography } from "antd";
import type { ContentAsset } from "../../pages/dionysus/content/assets";
import ContentAssetPreviewPlayer from "./ContentAssetPreviewPlayer";
import ContentAssetTagEditor from "./ContentAssetTagEditor";
import ContentAssetThumbnailGrid from "./ContentAssetThumbnailGrid";

export interface ContentAssetExpanderRowProps {
  record: ContentAsset;
  reloadAssets: (quiet: boolean) => Promise<void>;
}

const ContentAssetExpanderRow: React.FunctionComponent<
  ContentAssetExpanderRowProps
> = ({ record, reloadAssets }: ContentAssetExpanderRowProps) => {
  return (
    <Space
      direction={"vertical"}
      size={2}
      style={{
        width: "100%",
        marginLeft: 48,
      }}
    >
      <Row>
        <Col
          span={1}
          style={{
            minWidth: 120,
          }}
        >
          <Typography.Text strong={true}>Original Name:</Typography.Text>
        </Col>
        <Col span={18}>
          <Typography.Text>{record.originalName}</Typography.Text>
        </Col>
      </Row>
      <Row>
        <Col
          span={1}
          style={{
            minWidth: 120,
          }}
        >
          <Typography.Text strong={true} style={{ fontSize: 11 }}>
            Asset SHA:
          </Typography.Text>
        </Col>
        <Col span={18}>
          <Typography.Text copyable={true} style={{ fontSize: 11 }}>
            {record.newSha}
          </Typography.Text>
        </Col>
      </Row>
      <Row>
        <Col
          span={1}
          style={{
            minWidth: 120,
          }}
        >
          <Typography.Text strong={true} style={{ fontSize: 11 }}>
            Original SHA:
          </Typography.Text>
        </Col>
        <Col span={18}>
          <Typography.Text copyable={true} style={{ fontSize: 11 }}>
            {record.originalSha}
          </Typography.Text>
        </Col>
      </Row>
      <Row>
        <Col
          span={7}
          style={{
            marginRight: 16,
            borderRight: "1px",
            borderColor: "#ccc",
            borderRightStyle: "solid",
          }}
        >
          <Row
            style={{
              marginTop: 16,
            }}
          >
            <Typography.Text strong={true}>Thumbnails</Typography.Text>
          </Row>
          <ContentAssetThumbnailGrid asset={record} />
        </Col>
        <Col
          span={3}
          style={{
            minWidth: 250,
          }}
        >
          <Row
            style={{
              marginTop: 16,
            }}
          >
            <Typography.Text strong={true}>Preview</Typography.Text>
          </Row>
          <Row>
            <ContentAssetPreviewPlayer assetId={record.id} type={"sample"} />
          </Row>
          <Row
            style={{
              marginTop: 16,
            }}
          >
            <Typography.Text strong={true}>Timelapse</Typography.Text>
          </Row>
          <Row>
            <ContentAssetPreviewPlayer assetId={record.id} type={"timelapse"} />
          </Row>
        </Col>
        <Col
          span={2}
          style={{
            marginRight: 16,
            marginLeft: 16,
            borderRight: 1,
            borderLeft: 1,
            borderColor: "#ccc",
            borderRightStyle: "solid",
            borderLeftStyle: "solid",
            minWidth: 240,
          }}
        >
          <Row
            style={{
              marginTop: 16,
              marginLeft: 12,
            }}
          >
            <Typography.Text strong={true}>QR</Typography.Text>
          </Row>
          <QRCode
            value={`dionysus://content/${record.id}`}
            size={225}
            errorLevel={"H"}
            bordered={false}
            style={{
              backgroundColor: "transparent",
            }}
          />
        </Col>
        <Col span={7}>
          <ContentAssetTagEditor
            asset={record}
            onTagRemoved={async (tag) => {
              if (
                tag.type === "system" &&
                tag.name.toLowerCase() === "bccompliant"
              ) {
                await reloadAssets(true);
              }
            }}
          />
        </Col>
      </Row>
    </Space>
  );
};
export default ContentAssetExpanderRow;
