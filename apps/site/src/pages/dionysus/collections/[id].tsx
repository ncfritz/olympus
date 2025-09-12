import {
  BookOutlined,
  HeartOutlined,
  HomeOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { Collection } from "@ncfritz/olympus-sdk/dionysus";
import {
  Breadcrumb,
  Layout,
  Space,
  Spin,
  Typography,
  Tabs,
  Button,
  Progress,
} from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import metadataApi from "../../../api/metadataApi";
import CollectionImagesPanel from "../../../components/dionysus/metadata/CollectionImagesPanel";
import MovieList from "../../../components/dionysus/metadata/MovieList";
import { useFetch } from "../../../hooks/useFetch";
import { MetadataOutlinedIcon } from "../../../icons";

const MovieDetailPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const [activeTab, setActiveTab] = useState("t-main-general");

  const [collection, collectionLoading, collectionError] = useFetch<
    number,
    Collection
  >({
    dataType: "collection details",
    watch: [id],
    params: id as unknown as number,
    fetchFunction: async (o) =>
      (await metadataApi.describeCollection(o)).data.collection,
  });

  let content = (
    <Space style={{ margin: 16 }}>
      <Spin size={"large"} />
    </Space>
  );

  if (collection) {
    const headerBackgroundUrl = collection?.backdropPath
      ? `https://image.tmdb.org/t/p/w1280/${collection.backdropPath}`
      : "/section_header.png";

    const overview = collection.overview ? (
      <Space direction={"vertical"} size={0}>
        <Typography.Title
          style={{ color: "#efefef", marginBottom: 0 }}
          level={4}
        >
          Overview
        </Typography.Title>
        <Typography.Text
          style={{ color: "#efefef", maxWidth: 1024, display: "flex" }}
        >
          {collection?.overview}
        </Typography.Text>
      </Space>
    ) : undefined;

    content = (
      <Space
        direction={"vertical"}
        size={0}
        style={{ width: "100%", height: "100%" }}
        styles={{ item: { width: "100%" } }}
      >
        <Space
          size={0}
          direction={"vertical"}
          className={"movieHeader"}
          style={{
            minHeight: 372,
            maxHeight: 372,
            width: "100%",
            backgroundColor: "#021629",
            backgroundImage: `linear-gradient(90deg, rgba(0, 21, 41, 1) 10%, rgba(0, 0, 0, 0.4) 100%), url("${headerBackgroundUrl}")`,
            backgroundPosition: "left 150px top",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            borderBottom: "1px solid #efefef",
            alignItems: "start",
            position: "relative",
            top: 25,
          }}
          styles={{
            item: { width: "100%" },
          }}
        >
          <Breadcrumb
            className={"dark"}
            style={{
              padding: 8,
              background: "#021629",
              marginBottom: 32,
              position: "fixed",
              top: 64,
              left: 380,
              width: "100%",
              zIndex: 100,
            }}
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
                    <Space size={4}>
                      <MetadataOutlinedIcon />
                      <span>Dionysus</span>
                    </Space>
                  </Link>
                ),
              },
              {
                title: (
                  <Link href={"/dionysus/collections"}>
                    <Space size={4}>
                      <MetadataOutlinedIcon />
                      <span>Collections</span>
                    </Space>
                  </Link>
                ),
              },
              {
                title: (
                  <Space size={4}>
                    <MetadataOutlinedIcon />
                    <span>
                      {collection?.name ? collection.name : "Loading..."}
                    </span>
                  </Space>
                ),
              },
            ]}
          />
          <Space
            direction={"horizontal"}
            size={32}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "start",
              marginTop: 16,
              padding: 16,
            }}
          >
            <Space
              direction={"vertical"}
              style={{ width: "100%", height: "100%", alignItems: "top" }}
            >
              <Typography.Title
                level={1}
                style={{ color: "#ffffffdd", marginBottom: 3 }}
              >
                {collection?.name}
              </Typography.Title>
              <Space direction={"vertical"} style={{ marginTop: 16 }}>
                {overview}
              </Space>
            </Space>
          </Space>
        </Space>
        <Space
          direction={"horizontal"}
          style={{ width: "100%", top: 24, position: "relative" }}
          styles={{
            item: {
              width: "100%",
              minHeight: "calc(100vh - 673px",
            },
          }}
        >
          <Space
            direction={"vertical"}
            style={{
              width: "100%",
              minHeight: "calc(100vh - 673px",
            }}
          >
            <Tabs
              className={"fill"}
              activeKey={activeTab}
              onChange={(activeKey: string) => {
                setActiveTab(activeKey);
              }}
              tabPosition={"top"}
              size={"small"}
              items={[
                {
                  key: "t-main-general",
                  label: "Overview",
                  children: (
                    <Space
                      direction={"vertical"}
                      style={{ width: "100%", padding: 16 }}
                    >
                      <Typography.Title level={4} style={{ marginBottom: 0 }}>
                        Movies in this collection...
                      </Typography.Title>
                      <MovieList
                        movies={collection.parts.map((part) => part.movie)}
                        loading={collectionLoading}
                        columns={12}
                      />
                    </Space>
                  ),
                },
                {
                  key: "t-main-images",
                  label: "Images",
                  children: (
                    <Space
                      direction={"vertical"}
                      style={{ width: "100%", padding: 16 }}
                    >
                      <CollectionImagesPanel images={collection.images} />
                    </Space>
                  ),
                },
              ]}
            />
          </Space>
        </Space>
      </Space>
    );
  }

  return (
    <Layout
      style={{
        position: "fixed",
        background: "#ffffff",
        gap: 16,
        top: 64,
        overflowX: "hidden",
        overflowY: "auto",
        height: "calc(100vh - 64px)",
      }}
    >
      <Content style={{ width: "calc(100vw - 380px)" }}>{content}</Content>
    </Layout>
  );
};

export default MovieDetailPage;
