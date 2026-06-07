import {
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  StarFilled,
  StarOutlined,
} from "@ant-design/icons";
import type {
  ContentAssetChannel,
  ContentAssetChannelCategory,
} from "@ncfritz/olympus-sdk/dionysus";
import { Card, Col, Empty, Row, Space, Typography } from "antd";
import { useRouter } from "next/router";
import React, { type CSSProperties, type ReactNode, useState } from "react";
import contentApi from "../../api/contentApi";
import ContentAssetChannelModal, {
  type ContentAssetChannelFormData,
} from "./ContentAssetChannelModal";
import ContentAssetFixedRatioImage from "./ContentAssetFixedRatioImage";

export interface ContentAssetChannelCardProps {
  initialChannel: ContentAssetChannel;
  category: ContentAssetChannelCategory;
  index: number;
  itemId: string;
  afterDelete?: () => Promise<void>;
  showActions?: boolean;
}

const ContentAssetChannelCard: React.FunctionComponent<
  ContentAssetChannelCardProps
> = ({
  initialChannel,
  category,
  index,
  itemId,
  afterDelete,
  showActions = true,
}) => {
  const router = useRouter();

  const [channel, setChannel] = useState(initialChannel);
  const [channelModalOpen, setChannelModalOpen] = useState(false);

  let previewCount = 1;
  let previewRows = 1;

  if (channel.assetCache.length >= 9) {
    previewCount = 9;
    previewRows = 3;
  } else if (channel.assetCache.length >= 4) {
    previewCount = 4;
    previewRows = 2;
  }

  const previews: ReactNode[] = [];

  if (channel.assetCache.length > 0) {
    for (let i = 0; i < previewCount; i++) {
      const cachedAsset = channel.assetCache[i];
      let style: CSSProperties = {};

      if (previewCount === 1) {
        style = {
          borderTopLeftRadius: "inherit",
          borderTopRightRadius: "inherit",
        };
      } else if (i === 0) {
        style = { borderTopLeftRadius: "inherit" };
      } else if (i === previewRows - 1) {
        style = { borderTopRightRadius: "inherit" };
      }

      previews.push(
        <Col key={`col-${i}`} span={24 / previewRows} style={style}>
          <ContentAssetFixedRatioImage
            style={style}
            assetId={cachedAsset.assetId}
            previewIndex={2}
            allowPreview={false}
            width={cachedAsset.width}
            height={cachedAsset.height}
            maxWidth={400 / previewRows}
            maxHeight={225 / previewRows}
          />
        </Col>,
      );
    }
  } else {
    previews.push(
      <Col
        key={"empty-col"}
        span={24}
        style={{
          height: 225,
          width: 400,
          borderBottom: "1px solid #efefef",
          alignContent: "center",
        }}
      >
        <Empty />
      </Col>,
    );
  }

  const cover = (
    <Row gutter={0} style={{ display: "flex", borderRadius: "inherit" }}>
      {previews}
    </Row>
  );

  const favoriteChannel = async () => {
    const response = (
      await contentApi.favoriteContentAssetChannel(
        channel.id,
        !channel.favorite,
      )
    ).data;
    setChannel(response.channel);
  };

  const actions: ReactNode[] = [];

  if (showActions) {
    actions.push(
      <ReloadOutlined
        key="setting"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const refreshResponse = (
            await contentApi.refreshContentAssetChannel(channel.id)
          ).data;
          setChannel(refreshResponse.channel);
        }}
      />,
    );
    actions.push(
      <EditOutlined
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();

          setChannelModalOpen(true);
        }}
      />,
    );
    actions.push(
      channel.favorite ? (
        <StarFilled
          key="favorite"
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();

            await favoriteChannel();
          }}
        />
      ) : (
        <StarOutlined
          key="favorite"
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();

            await favoriteChannel();
          }}
        />
      ),
    );
    actions.push(
      <DeleteOutlined
        key="delete"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();

          await contentApi.deleteContentAssetChannel(channel.id);

          if (afterDelete) {
            await afterDelete();
          }
        }}
      />,
    );
  }

  return (
    <div data-cy={itemId}>
      <Card
        hoverable={false}
        style={{
          width: 400,
          marginRight: 16,
        }}
        styles={{ body: { padding: 8 }, cover: { borderRadius: "inherit" } }}
        tabIndex={index}
        cover={cover}
        actions={actions}
        onClick={async () => {
          await router.push(
            `/dionysus/content/channel/${channel.id}`,
            `/dionysus/content/channel/${channel.id}`,
            { shallow: true },
          );
        }}
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
          <Typography.Text style={{ fontSize: "12px" }}>
            {channel.description}
          </Typography.Text>
        </Space>
      </Card>
      <ContentAssetChannelModal
        initialData={
          JSON.parse(channel.filterInput) as ContentAssetChannelFormData
        }
        channelId={channel.id}
        category={category}
        isOpen={channelModalOpen}
        close={() => {
          setChannelModalOpen(false);
        }}
        onSuccess={async (channel) => {
          setChannel(channel);
        }}
      />
    </div>
  );
};
export default ContentAssetChannelCard;
