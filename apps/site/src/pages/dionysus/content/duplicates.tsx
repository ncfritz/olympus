import { HomeOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Breadcrumb, Space } from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React from "react";
import ContentAuthWrapper from "../../../components/content/ContentAuthWrapper";

const DuplicatesPage: React.FunctionComponent = () => {
  return (
    <ContentAuthWrapper>
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
                <Space>
                  <VideoCameraOutlined />
                  <span>Dionysus</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space>
                <VideoCameraOutlined />
                <span>Duplicates</span>
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
            padding: 16,
          }}
        >
          Duplicates
        </Content>
      </Content>
    </ContentAuthWrapper>
  );
};
export default DuplicatesPage;
