import { HomeOutlined, VideoCameraOutlined } from "@ant-design/icons";
import type { FullContentAssetChannel } from "@ncfritz/olympus-sdk/dionysus";
import { Breadcrumb, Button, Empty, Space, Typography } from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React, { type ReactNode } from "react";
import { ScrollMenu } from "react-horizontal-scrolling-menu";
import contentApi from "../../../api/contentApi";
import LoadingWrapper from "../../../components/common/LoadingWrapper";
import ContentAssetChannelCard from "../../../components/content/ContentAssetChannelCard";
import ContentAssetStatistics from "../../../components/content/ContentAssetStatistics";
import ContentAuthWrapper from "../../../components/content/ContentAuthWrapper";
import {
  LeftArrow,
  RightArrow,
} from "../../../components/content/scroller/arrows";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import "react-horizontal-scrolling-menu/dist/styles.css";

const IndexPage: React.FunctionComponent = () => {
  const [channels, channelsLoading, channelsError] = useFetch<
    undefined,
    FullContentAssetChannel[]
  >({
    dataType: "content channels",
    params: undefined,
    watch: [],
    fetchFunction: async () => {
      return (
        await contentApi.listContentAssetChannels(
          0,
          10,
          { field: "lastUpdatedTime", order: "desc" },
          { name: "favorite", type: "eq", value: true },
        )
      ).data.channels;
    },
  });

  let channelsContent: ReactNode = <Empty />;

  if (channels?.length > 0) {
    const channelCards: React.ReactElement<{
      itemId: string;
    }>[] = [];

    channels.forEach((channel, index) => {
      channelCards.push(
        <ContentAssetChannelCard
          key={`channel-${channel.id}`}
          initialChannel={channel}
          category={channel.category}
          index={index}
          itemId={`c-${channel.id}`}
          showActions={false}
        />,
      );
    });

    channelsContent = (
      <ScrollMenu LeftArrow={LeftArrow} RightArrow={RightArrow}>
        {channelCards}
      </ScrollMenu>
    );
  }

  return (
    <ContentAuthWrapper>
      <OlympusBreadcrumbs
        items={[
          {
            title: (
              <Link href={"/"}>
                <Space size={4}>
                  <HomeOutlined />
                  <span>Home</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space>
                <VideoCameraOutlined />
                <span>Dionysus</span>
              </Space>
            ),
          },
        ]}
      />
      <Content
        style={{
          background: "#fff",
        }}
      >
        <Content
          style={{
            height: "calc(100vh - 102px)",
            overflowX: "hidden",
            overflowY: "auto",
          }}
        >
          <ContentAssetStatistics />
          <Space
            direction={"vertical"}
            size={0}
            style={{
              width: "100%",
              borderTop: "1px solid #efefef",
              padding: 16,
            }}
            styles={{ item: {} }}
          >
            <Space
              direction={"horizontal"}
              style={{ width: "100%", justifyContent: "space-between" }}
            >
              <Typography.Title level={5}>Favorite Channels</Typography.Title>
              <Button type={"text"} href={"/dionysus/content/channels"}>
                View All Channels
              </Button>
            </Space>
            <LoadingWrapper
              loading={!channels || channelsLoading}
              error={channelsError}
            >
              {channelsContent}
            </LoadingWrapper>
          </Space>
        </Content>
      </Content>
    </ContentAuthWrapper>
  );
};

export default IndexPage;
