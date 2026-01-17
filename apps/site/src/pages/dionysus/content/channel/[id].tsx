import {
  AppstoreOutlined,
  CameraOutlined,
  EditOutlined,
  HomeOutlined,
  LoadingOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type {
  ContentAsset,
  FullContentAssetChannel,
  FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import { Button, Space, Spin, Typography } from "antd";
import { Content } from "antd/lib/layout/layout";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import type { SortOptions } from "../../../../api/common";
import contentApi from "../../../../api/contentApi";
import LoadingWrapper from "../../../../components/common/LoadingWrapper";
import ContentAssetChannelModal, {
  type ContentAssetChannelFormData,
} from "../../../../components/content/ContentAssetChannelModal";
import ContentAuthWrapper from "../../../../components/content/ContentAuthWrapper";
import OlympusBreadcrumbs from "../../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../../hooks/useFetch";

const ContentAssetCard = dynamic(
  () => import("../../../../components/content/ContentAssetCard"),
  { ssr: false },
);

const ChannelDetailsPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const [assetsPage, setAssetsPage] = useState(0);
  const [assetsSort, setAssetsSort] = useState<SortOptions>({
    field: "rating",
    order: "desc",
  });
  const [assetCount, setAssetCount] = useState(0);
  const [fetchedAssets, setFetchedAssets] = useState<ContentAsset[]>([]);
  const [channelModalOpen, setChannelModalOpen] = useState(false);

  const fetchAssets = async (o: FullContentAssetChannel) => {
    if (!o?.encodedFilter) {
      setAssetCount(0);
      return [];
    }

    const response = (
      await contentApi.listAssets(
        assetsPage,
        5,
        assetsSort,
        JSON.parse(
          Buffer.from(o.encodedFilter, "base64").toString(),
        ) as FilterDefinition,
      )
    ).data;

    setAssetCount(response.count);
    setAssetsPage(assetsPage + 1);

    return response.assets;
  };

  const [channel, channelLoading, channelError, fetchChannel, setChannel] =
    useFetch<string, FullContentAssetChannel>({
      dataType: "content asset channel",
      params: id as string,
      watch: [id],
      fetchFunction: async (o) => {
        return (await contentApi.describeContentAssetChannel(o)).data.channel;
      },
    });

  const [, assetsLoading, assetsError] = useFetch<
    FullContentAssetChannel,
    ContentAsset[]
  >({
    dataType: "content assets",
    params: channel as FullContentAssetChannel,
    watch: [channel],
    fetchFunction: async (o) => {
      const assets = await fetchAssets(o);

      setFetchedAssets(assets);

      return assets;
    },
  });

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
              <Link href={"/dionysus"}>
                <Space>
                  <VideoCameraOutlined />
                  <span>Dionysus</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus/content"}>
                <Space>
                  <VideoCameraOutlined />
                  <span>Content</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus/content/channels"}>
                <Space>
                  <VideoCameraOutlined />
                  <span>Channels</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space>
                <VideoCameraOutlined />
                <span>
                  {!channel || channelLoading ? (
                    <Space direction={"horizontal"}>
                      <LoadingOutlined spin={true} />
                      Loading...
                    </Space>
                  ) : (
                    channel.name
                  )}
                </span>
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
          <LoadingWrapper
            loading={assetsLoading || channelLoading}
            error={assetsError || channelError}
          >
            {channel && (
              <Space
                direction={"horizontal"}
                style={{
                  width: "100%",
                  justifyContent: "space-between",
                  backgroundColor: "#fcfcfc",
                  borderBottom: "1px solid #efefef",
                }}
              >
                <Space direction={"vertical"} style={{ padding: 16 }} size={8}>
                  <Space direction={"vertical"} size={0}>
                    <Typography.Title
                      level={4}
                      style={{ color: "#999999", marginBottom: 0 }}
                    >
                      {channel.name}
                    </Typography.Title>
                    <Space direction={"horizontal"} size={8}>
                      <Typography.Text
                        style={{ fontSize: "11px", color: "#666666" }}
                      >
                        <Space
                          direction={"horizontal"}
                          size={4}
                          style={{ alignItems: "center" }}
                        >
                          <AppstoreOutlined />
                          Category:
                          <Link
                            style={{ color: "#666666" }}
                            href={`/dionysus/content/category/${channel.category.id}`}
                          >
                            {channel.category.name}
                          </Link>
                        </Space>
                      </Typography.Text>
                      •
                      <Typography.Text
                        style={{ fontSize: "11px", color: "#666666" }}
                      >
                        <Space
                          direction={"horizontal"}
                          size={4}
                          style={{ alignItems: "center" }}
                        >
                          <CameraOutlined />
                          Asset Count:
                          {channel.assetCount}
                        </Space>
                      </Typography.Text>
                    </Space>
                  </Space>
                  <Typography.Text>{channel.description}</Typography.Text>
                </Space>
                <Space direction={"horizontal"} style={{ padding: 16 }}>
                  <Button
                    type={"primary"}
                    icon={<EditOutlined />}
                    onClick={() => {
                      setChannelModalOpen(true);
                    }}
                  >
                    Edit Channel
                  </Button>
                </Space>
              </Space>
            )}
            {channel && fetchedAssets && (
              <Space
                id={"infiniteScrollContainer"}
                direction={"vertical"}
                style={{
                  width: "100%",
                  overflowY: "scroll",
                  height: "calc(100vh - 218px)",
                  padding: 16,
                }}
              >
                <InfiniteScroll
                  next={() => {
                    console.log("next()");
                    (async () => {
                      const newAssets = await fetchAssets(channel!);
                      setFetchedAssets([...fetchedAssets, ...newAssets]);
                    })();
                  }}
                  hasMore={fetchedAssets.length < channel.assetCount}
                  loader={
                    <Space
                      style={{ width: "100%", textAlign: "center" }}
                      styles={{ item: { width: "100%", textAlign: "center" } }}
                    >
                      <Spin />
                    </Space>
                  }
                  dataLength={fetchedAssets.length}
                  pullDownToRefresh={assetCount > fetchedAssets.length}
                  scrollableTarget={"infiniteScrollContainer"}
                >
                  {fetchedAssets &&
                    fetchedAssets.map((asset, index) => {
                      return (
                        <ContentAssetCard
                          key={`cac-${index}`}
                          asset={asset}
                          style={{ marginBottom: 8 }}
                        />
                      );
                    })}
                </InfiniteScroll>
                <ContentAssetChannelModal
                  initialData={
                    JSON.parse(
                      channel.filterInput,
                    ) as ContentAssetChannelFormData
                  }
                  channelId={channel.id}
                  category={channel.category}
                  isOpen={channelModalOpen}
                  close={() => {
                    setChannelModalOpen(false);
                  }}
                  onSuccess={async (channel) => {
                    setChannel(channel);
                    setAssetsPage(0);
                    setFetchedAssets(await fetchAssets(channel));
                  }}
                />
              </Space>
            )}
          </LoadingWrapper>
        </Content>
      </Content>
    </ContentAuthWrapper>
  );
};
export default ChannelDetailsPage;
