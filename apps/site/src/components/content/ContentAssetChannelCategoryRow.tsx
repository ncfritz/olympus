import {
  AppstoreOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { FullContentAssetChannelCategory } from "@ncfritz/olympus-sdk/dionysus";
import { Button, Card, Space, Typography } from "antd";
import { useRouter } from "next/router";
import React, { useState } from "react";
import { ScrollMenu } from "react-horizontal-scrolling-menu";
import contentApi from "../../api/contentApi";
import { useFetch } from "../../hooks/useFetch";
import LoadingWrapper from "../common/LoadingWrapper";
import ContentAssetChannelCard from "./ContentAssetChannelCard";
import ContentAssetChannelCategoryModal from "./ContentAssetChannelCategoryModal";
import ContentAssetChannelModal, {
  type ContentAssetChannelFormData,
} from "./ContentAssetChannelModal";
import { LeftArrow, RightArrow } from "./scroller/arrows";
import "react-horizontal-scrolling-menu/dist/styles.css";

export interface ContentAssetChannelCategoryRowProps {
  initialCategory: FullContentAssetChannelCategory;
}

const ContentAssetChannelCategoryRow: React.FunctionComponent<
  ContentAssetChannelCategoryRowProps
> = ({ initialCategory }: ContentAssetChannelCategoryRowProps) => {
  const router = useRouter();

  const [category, setCategory] = useState(initialCategory);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [channelModalData, setChannelModalData] = useState<
    ContentAssetChannelFormData | undefined
  >(undefined);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const [, categoryLoading, categoryError, fetchCategory] = useFetch<
    string,
    FullContentAssetChannelCategory
  >({
    dataType: "content asset category",
    noWatch: true,
    params: category?.id as string,
    fetchFunction: async (o) => {
      return (await contentApi.describeContentAssetChannelCategory(o)).data
        .category;
    },
    onDataFetched: async (data) => {
      setCategory(data);
    },
  });

  const channelContent: React.ReactElement<{
    itemId: string;
  }>[] = [];

  if (category) {
    category.channels.forEach((item, index) => {
      channelContent.push(
        <ContentAssetChannelCard
          key={`channel-${item.id}`}
          initialChannel={item}
          index={index}
          itemId={`c-${item.id}`}
          category={category}
          afterDelete={async () => {
            await fetchCategory(true);
          }}
        />,
      );
    });

    channelContent.push(
      <Card
        key={"channels-add"}
        hoverable={false}
        style={{
          width: 150,
          height: "100%",
          marginRight: 16,
        }}
        styles={{ body: { height: "100%", alignContent: "center" } }}
        tabIndex={category.channels?.length}
        onClick={() => setChannelModalOpen(true)}
      >
        <Space
          direction={"vertical"}
          style={{
            width: "100%",
            alignItems: "center",
          }}
          styles={{ item: { height: "100%", alignContent: "center" } }}
        >
          <Typography.Text style={{ fontSize: "80px", color: "#dddddd" }}>
            <PlusOutlined />
          </Typography.Text>
          <Typography.Text style={{ fontSize: "13px", color: "#dddddd" }}>
            Add Channel
          </Typography.Text>
        </Space>
      </Card>,
    );
    channelContent.push(
      <Card
        key={"channel-view"}
        hoverable={false}
        style={{
          width: 150,
          height: "100%",
          marginRight: 16,
        }}
        styles={{ body: { height: "100%", alignContent: "center" } }}
        tabIndex={category.channels?.length + 1}
        onClick={async () => {
          await router.push(
            `/dionysus/content/category/${category.id}`,
            `/dionysus/content/category/${category.id}`,
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
          <Typography.Text style={{ fontSize: "80px", color: "#dddddd" }}>
            <AppstoreOutlined />
          </Typography.Text>
          <Typography.Text style={{ fontSize: "13px", color: "#dddddd" }}>
            View Category
          </Typography.Text>
        </Space>
      </Card>,
    );
  }

  return (
    <LoadingWrapper
      loading={!category || categoryLoading}
      error={categoryError}
    >
      <Space direction={"vertical"} style={{ width: "100%" }}>
        <Space direction={"vertical"} size={2} style={{ width: "100%" }}>
          <Space
            direction={"horizontal"}
            size={2}
            style={{
              width: "100%",
              justifyContent: "space-between",
              alignItems: "center",
              paddingRight: 16,
            }}
          >
            <Typography.Title level={5} style={{ marginBottom: 0 }}>
              <Space direction={"horizontal"} size={0}>
                {category.name}
                <Button
                  type={"text"}
                  icon={<EditOutlined />}
                  onClick={() => setCategoryModalOpen(true)}
                />
              </Space>
            </Typography.Title>
            <Typography.Text style={{ color: "#666666" }}>
              <Space
                direction={"horizontal"}
                size={4}
                style={{ alignItems: "center" }}
              >
                <AppstoreOutlined />
                Channels:
                {category.channelCount}
              </Space>
            </Typography.Text>
          </Space>
          <ScrollMenu LeftArrow={LeftArrow} RightArrow={RightArrow}>
            {channelContent}
          </ScrollMenu>
        </Space>
        <ContentAssetChannelModal
          initialData={channelModalData}
          category={category}
          isOpen={channelModalOpen}
          close={() => {
            setChannelModalOpen(false);
            setChannelModalData(undefined);
          }}
          onSuccess={async () => {
            await fetchCategory(true);
          }}
        />
        <ContentAssetChannelCategoryModal
          isOpen={categoryModalOpen}
          close={() => {
            setCategoryModalOpen(false);
          }}
          categoryId={category.id}
          initialData={{ name: category.name }}
          onSuccess={async (category) => {
            setCategory(category);
          }}
        />
      </Space>
    </LoadingWrapper>
  );
};
export default ContentAssetChannelCategoryRow;
