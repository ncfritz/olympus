import { CameraOutlined, PlayCircleOutlined } from "@ant-design/icons";
import type {
  ContentAssetChannel,
  ContentAssetChannelCacheEntry,
} from "@ncfritz/olympus-sdk/dionysus";
import { Card, Empty, Space, Typography } from "antd";
import { useRouter } from "next/router";
import React, { type CSSProperties, type ReactNode } from "react";
import ContentAssetFixedRatioImage from "./ContentAssetFixedRatioImage";

export interface ContentAssetCategoryChannelCardProps {
  channel: ContentAssetChannel;
  style?: CSSProperties;
}

const ContentAssetCategoryChannelCard: React.FunctionComponent<
  ContentAssetCategoryChannelCardProps
> = ({ channel, style }: ContentAssetCategoryChannelCardProps) => {
  const router = useRouter();

  const getAssetImage = (
    entry: ContentAssetChannelCacheEntry,
    size: number,
  ) => {
    try {
      return (
        <ContentAssetFixedRatioImage
          key={`cacc-img-${entry.assetId}`}
          assetId={entry.assetId}
          previewIndex={4}
          width={entry.width}
          height={entry.height}
          maxWidth={size}
          maxHeight={size}
          forceMax={true}
          allowPreview={false}
          style={{ borderRadius: 6 }}
          onClick={async () => {
            await router.push(
              `/dionysus/content/asset/${entry.assetId}`,
              `/dionysus/content/asset/${entry.assetId}`,
              { shallow: true },
            );
          }}
        />
      );
    } catch (e) {
      console.log(e.stack);
    }
    return undefined;
  };

  const getChannelCard = (size: number) => (
    <Card
      hoverable={false}
      style={{
        width: 125,
        height: size,
        marginRight: 16,
      }}
      styles={{
        body: { height: "100%", alignContent: "center", padding: 8 },
      }}
      onClick={async () => {
        await router.push(
          `/dionysus/content/channel/${channel.id}`,
          `/dionysus/content/channel/${channel.id}`,
          { shallow: true },
        );
      }}
    >
      <Space
        direction={"vertical"}
        style={{
          width: "100%",
          alignItems: "center",
        }}
        styles={{ item: { height: "100%", alignContent: "center" } }}
      >
        <Typography.Text
          style={{ fontSize: size > 125 ? "65px" : "32px", color: "#dddddd" }}
        >
          <CameraOutlined />
        </Typography.Text>
        <Typography.Text
          style={{
            fontSize: "13px",
            color: "#dddddd",
            textAlign: "center",
            width: "100%",
            display: "block",
          }}
        >
          And {channel.assetCount - channel.assetCache.length} more...
        </Typography.Text>
      </Space>
    </Card>
  );

  const large = () => {
    return Math.random() < 0.8;
  };

  const content: ReactNode[] = [];
  let largeImages = 0;

  if (channel.assetCache.length <= 0) {
    content.push(<Empty />);
  } else {
    for (let i = 0; i < channel.assetCache.length + 1; i++) {
      if (i >= channel.assetCache.length) {
        if ((large() && largeImages < 4) || i >= channel.assetCache.length) {
          content.push(getChannelCard(258));
        } else {
          content.push(
            <Space orientation={"vertical"} style={{ alignItems: "start" }}>
              {getChannelCard(125)}
            </Space>,
          );
        }

        continue;
      }

      if (channel.assetCache.length <= 3) {
        content.push(getAssetImage(channel.assetCache[i], 258));
        largeImages++;
      } else {
        if (large() && largeImages < 4) {
          content.push(getAssetImage(channel.assetCache[i], 258));
          largeImages++;
        } else {
          content.push(
            <Space orientation={"vertical"} style={{ alignItems: "start" }}>
              {i < channel.assetCache.length
                ? getAssetImage(channel.assetCache[i], 125)
                : getChannelCard(125)}
              {i + 1 <= channel.assetCache.length &&
              i + 1 < channel.assetCache.length
                ? getAssetImage(channel.assetCache[i + 1], 125)
                : getChannelCard(125)}
            </Space>,
          );

          i += 1;
        }
      }
    }
  }

  return (
    <Card
      hoverable={false}
      style={{
        ...style,
        width: "100%",
      }}
      styles={{ body: { padding: 8 } }}
    >
      <Space orientation={"vertical"} size={0} style={{ width: "100%" }}>
        <Space
          direction={"horizontal"}
          size={0}
          style={{ width: "100%", justifyContent: "space-between" }}
        >
          <Typography.Text
            style={{ fontSize: "14px", color: "#666666", fontWeight: 700 }}
          >
            {channel.name}
          </Typography.Text>
          <Typography.Text style={{ fontSize: "12px", color: "#666666" }}>
            <Space orientation={"horizontal"}>
              <PlayCircleOutlined />
              {channel.assetCount}
            </Space>
          </Typography.Text>
        </Space>
        <Space orientation={"horizontal"} size={8}>
          {content}
        </Space>
      </Space>
    </Card>
  );
};
export default ContentAssetCategoryChannelCard;
