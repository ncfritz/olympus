import { HomeOutlined } from "@ant-design/icons";
import { Affix, Breadcrumb, Layout, Space } from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React from "react";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../icons";

const GenresIndexPage: React.FunctionComponent = () => {
  return (
    <>
      <Affix offsetTop={64}>
        <Breadcrumb
          style={{ padding: 8, background: "#f6f6f6" }}
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
                <Space>
                  <CertificationOutlined />
                  <span>Genres</span>
                </Space>
              ),
            },
          ]}
        />
      </Affix>
      <Layout
        style={{
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 102,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 102px)",
        }}
      >
        <Content style={{ width: "calc(100vw - 384px)" }}>Genres</Content>
      </Layout>
    </>
  );
};

export default GenresIndexPage;
