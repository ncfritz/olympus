import { HomeOutlined } from "@ant-design/icons";
import type { Collection } from "@ncfritz/olympus-sdk/dionysus";
import { Space, Spin, Typography, Tabs } from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import metadataApi from "../../../api/metadataApi";
import CollectionImagesPanel from "../../../components/dionysus/metadata/CollectionImagesPanel";
import MovieList from "../../../components/dionysus/metadata/MovieList";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { MetadataOutlinedIcon } from "../../../icons";

const MovieDetailPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const [activeTab, setActiveTab] = useState("t-main-general");

  const [collection, collectionLoading] = useFetch<number, Collection>({
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
      <Space orientation={"vertical"} size={0}>
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
          }}
          styles={{
            item: { width: "100%" },
          }}
        >
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
              <Space orientation={"vertical"} style={{ marginTop: 16 }}>
                {overview}
              </Space>
            </Space>
          </Space>
        </Space>
        <Space
          direction={"horizontal"}
          style={{ width: "100%", position: "relative" }}
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
    <>
      <OlympusBreadcrumbs
        className={"dark"}
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
                <span>{collection?.name ? collection.name : "Loading..."}</span>
              </Space>
            ),
          },
        ]}
      />
      {content}
    </>
  );
};

export default MovieDetailPage;
