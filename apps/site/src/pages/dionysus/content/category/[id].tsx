import {
  AppstoreOutlined,
  EditOutlined,
  HomeOutlined,
  LoadingOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type {
  ContentAssetChannel,
  FullContentAssetChannelCategory,
} from "@ncfritz/olympus-sdk/dionysus";
import { Breadcrumb, Button, Space, Spin, Typography } from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import type { SortOptions } from "../../../../api/common";
import contentApi from "../../../../api/contentApi";
import LoadingWrapper from "../../../../components/common/LoadingWrapper";
import ContentAssetCategoryChannelCard from "../../../../components/content/ContentAssetCategoryChannelCard";
import ContentAssetChannelCategoryModal from "../../../../components/content/ContentAssetChannelCategoryModal";
import ContentAuthWrapper from "../../../../components/content/ContentAuthWrapper";
import OlympusBreadcrumbs from "../../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../../hooks/useFetch";

const DuplicatesPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const [channelsPage, setChannelsPage] = useState(0);
  const [channelsSort, setChannelsort] = useState<SortOptions>({
    field: "favorite",
    order: "desc",
  });
  const [channelCount, setChannelCount] = useState(0);
  const [fetchedChannels, setFetchedChannels] = useState<ContentAssetChannel[]>(
    [],
  );
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const fetchChannels = async (o: FullContentAssetChannelCategory) => {
    if (!o) {
      setChannelCount(0);
      return [];
    }

    const response = (
      await contentApi.listContentAssetChannelsForCategory(
        o.id,
        channelsPage,
        5,
        channelsSort,
      )
    ).data;

    setChannelCount(response.count);
    setChannelsPage(channelsPage + 1);

    return response.channels;
  };

  const [category, categoryLoading, categoryError, getchCategory, setCategory] =
    useFetch<string, FullContentAssetChannelCategory>({
      dataType: "content asset channel category",
      params: id as string,
      watch: [id],
      fetchFunction: async (o) => {
        return (await contentApi.describeContentAssetChannelCategory(o)).data
          .category;
      },
    });

  const [, channelsLoading, channelsError] = useFetch<
    FullContentAssetChannelCategory,
    ContentAssetChannel[]
  >({
    dataType: "content asset channels",
    params: category as FullContentAssetChannelCategory,
    watch: [category?.id],
    fetchFunction: async (o) => {
      const channels = await fetchChannels(o);

      setFetchedChannels(channels);

      return channels;
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
                  {!category || categoryLoading ? (
                    <Space direction={"horizontal"}>
                      <LoadingOutlined spin={true} />
                      Loading...
                    </Space>
                  ) : (
                    category.name
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
            loading={categoryLoading || channelsLoading}
            error={categoryError || channelsError}
          >
            {category && (
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
                      {category.name}
                    </Typography.Title>
                    <Typography.Text
                      style={{ fontSize: "11px", color: "#666666" }}
                    >
                      <Space
                        direction={"horizontal"}
                        size={4}
                        style={{ alignItems: "center" }}
                      >
                        <AppstoreOutlined />
                        Channel Count:
                        {category.channelCount}
                      </Space>
                    </Typography.Text>
                  </Space>
                </Space>
                <Space direction={"horizontal"} style={{ padding: 16 }}>
                  <Button
                    type={"primary"}
                    icon={<EditOutlined />}
                    onClick={() => {
                      setCategoryModalOpen(true);
                    }}
                  >
                    Edit Category
                  </Button>
                </Space>
              </Space>
            )}
            {category && fetchedChannels && (
              <Space
                id={"infiniteScrollContainer"}
                direction={"vertical"}
                style={{
                  width: "100%",
                  overflowY: "scroll",
                  height: "calc(100vh - 188px)",
                  padding: 16,
                }}
              >
                <InfiniteScroll
                  next={() => {
                    (async () => {
                      const newChannels = await fetchChannels(category!);
                      setFetchedChannels([...fetchedChannels, ...newChannels]);
                    })();
                  }}
                  hasMore={fetchedChannels.length < category.channelCount}
                  loader={
                    <Space
                      style={{ width: "100%", textAlign: "center" }}
                      styles={{ item: { width: "100%", textAlign: "center" } }}
                    >
                      <Spin />
                    </Space>
                  }
                  dataLength={fetchedChannels.length}
                  pullDownToRefresh={channelCount > fetchedChannels.length}
                  scrollableTarget={"infiniteScrollContainer"}
                >
                  {fetchedChannels &&
                    fetchedChannels.map((channel, index) => {
                      return (
                        <ContentAssetCategoryChannelCard
                          key={`cacc-${index}`}
                          channel={channel}
                          style={{ marginBottom: 16 }}
                        />
                      );
                    })}
                </InfiniteScroll>
                <ContentAssetChannelCategoryModal
                  categoryId={category.id}
                  initialData={category}
                  isOpen={categoryModalOpen}
                  onSuccess={async (category) => {
                    setCategory(category);
                  }}
                  close={() => setCategoryModalOpen(false)}
                />
              </Space>
            )}
          </LoadingWrapper>
        </Content>
      </Content>
    </ContentAuthWrapper>
  );
};
export default DuplicatesPage;
