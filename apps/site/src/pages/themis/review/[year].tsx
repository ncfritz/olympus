import { HomeOutlined, RadarChartOutlined } from "@ant-design/icons";
import { Breadcrumb, Layout, Space } from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";

const { Content } = Layout;

const IndexPage: React.FunctionComponent = () => {
  const router = useRouter();

  return (
    <Space>
      <Breadcrumb
        style={{
          padding: 8,
          background: "#f6f6f6",
          position: "fixed",
          top: 64,
          width: "100%",
          zIndex: 1000,
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
              <Link href={"/themis"}>
                <Space size={4}>
                  <RadarChartOutlined />
                  <span>Themis</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space size={4}>
                <RadarChartOutlined />
                <span>{router.query.year}</span>
              </Space>
            ),
          },
        ]}
      />
      <Layout
        style={{
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 102,
          marginRight: 788,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 202px)",
        }}
      >
        <Content style={{ width: "calc(100vw - 993px)" }}>
          {router.query.year}
        </Content>
      </Layout>
    </Space>
  );
};

export default IndexPage;
