import {
  HomeOutlined,
  PlusOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type {
  FullContentAssetChannelCategory,
  FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import { Button, Empty, Space, Typography } from "antd";
import { Content } from "antd/lib/layout/layout";
import dynamic from "next/dynamic";
import Link from "next/link";
import React, { useState } from "react";
import type { SortOptions } from "../../../api/common";
import contentApi from "../../../api/contentApi";
import LoadingWrapper from "../../../components/common/LoadingWrapper";
import ContentAssetChannelCategoryModal from "../../../components/content/ContentAssetChannelCategoryModal";
import ContentAuthWrapper from "../../../components/content/ContentAuthWrapper";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";

const ContentAssetChannelCategoryRow = dynamic(
  () => import("../../../components/content/ContentAssetChannelCategoryRow"),
  { ssr: false },
);

const ChannelsPage: React.FunctionComponent = () => {
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const [categoriesCount, setCategoriesCount] = useState(0);
  const [categoriesPage, setCategoriesPage] = useState(0);
  const [categoriesPageSize, setCategoriesPageSize] = useState(50);
  const [categoriesSort, setCategoriesSort] = useState<SortOptions>({
    field: "createdTime",
    order: "desc",
  });
  const [categoriesFilters, setCategoriesFilters] = useState<
    FilterDefinition | undefined
  >(undefined);
  const [categories, categoriesLoading, categoriesError, fetchCategories] =
    useFetch<undefined, FullContentAssetChannelCategory[]>({
      dataType: "content asset channel categories",
      params: undefined,
      fetchFunction: async () => {
        const response = (
          await contentApi.listContentAssetChannelCategories(
            categoriesPage,
            categoriesPageSize,
            categoriesSort,
            categoriesFilters,
          )
        ).data;
        setCategoriesCount(response.count);
        return response.categories;
      },
    });

  let categoriesContent = (
    <Empty description={"No categories found"} style={{ marginTop: 64 }}>
      <Button
        type={"primary"}
        icon={<PlusOutlined />}
        onClick={() => {
          setCategoryModalOpen(true);
        }}
      >
        Add a new category
      </Button>
    </Empty>
  );

  if (categories?.length > 0) {
    categoriesContent = (
      <Space orientation={"vertical"} style={{ width: "100%" }}>
        <Space
          direction={"horizontal"}
          style={{ width: "100%", justifyContent: "space-between" }}
        >
          <Typography.Title level={5}>Channels</Typography.Title>
          <Button
            type={"primary"}
            icon={<PlusOutlined />}
            onClick={() => {
              setCategoryModalOpen(true);
            }}
          >
            Create New Category
          </Button>
        </Space>
        <Space
          direction={"vertical"}
          size={8}
          style={{
            width: "100%",
            overflowY: "scroll",
            height: "calc(100vh - 174px)",
          }}
        >
          {categories.map((category, index) => {
            return (
              <ContentAssetChannelCategoryRow
                key={`category-${category.id}`}
                initialCategory={category}
              />
            );
          })}
        </Space>
      </Space>
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
              <Space>
                <VideoCameraOutlined />
                <span>Channels</span>
              </Space>
            ),
          },
        ]}
      />
      <Content
        style={{
          height: "calc(100vh - 102px)",
          overflowX: "hidden",
          overflowY: "auto",
          padding: 16,
          marginTop: 28,
        }}
      >
        <LoadingWrapper loading={categoriesLoading} error={categoriesError}>
          {categoriesContent}
        </LoadingWrapper>
      </Content>
      <ContentAssetChannelCategoryModal
        isOpen={categoryModalOpen}
        onSuccess={async () => {
          await fetchCategories(true);
        }}
        close={() => setCategoryModalOpen(false)}
      />
    </ContentAuthWrapper>
  );
};
export default ChannelsPage;
