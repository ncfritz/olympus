import {
  ExperimentOutlined,
  HomeOutlined,
  InboxOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Breadcrumb, Space, Typography, type UploadFile } from "antd";
import { Content } from "antd/lib/layout/layout";
import Dragger from "antd/lib/upload/Dragger";
import Link from "next/link";
import { useState } from "react";
import { flushSync } from "react-dom";
import ContentAuthWrapper from "../../../components/content/ContentAuthWrapper";

const AssetUploadPage: React.FunctionComponent = () => {
  const [files, setFiles] = useState<Record<string, UploadFile>>({});
  const [uploads, setUploads] = useState<UploadFile[]>([]);

  return (
    <ContentAuthWrapper>
      <Content>
        <Content
          style={{
            position: "fixed",
            display: "block",
            top: 64,
            zIndex: 100,
            width: "calc(100vw - 380px)",
          }}
        >
          <Breadcrumb
            style={{
              padding: 8,
              paddingLeft: 16,
              background: "#f6f6f6",
            }}
            items={[
              {
                title: (
                  <Link href={"/"}>
                    <Space direction={"horizontal"} size={4}>
                      <HomeOutlined />
                      <span>Home</span>
                    </Space>
                  </Link>
                ),
              },
              {
                title: (
                  <Link href={"/dionysus//content"}>
                    <Space direction={"horizontal"} size={4}>
                      <ExperimentOutlined />
                      <span>Content</span>
                    </Space>
                  </Link>
                ),
              },
              {
                href: "/dionysus//content/assets",
                title: (
                  <Link href={"/dionysus/content/assets"}>
                    {" "}
                    <Space direction={"horizontal"} size={4}>
                      <VideoCameraOutlined />
                      <span>Assets</span>
                    </Space>
                  </Link>
                ),
              },
              {
                title: <Typography.Text>Asset Upload</Typography.Text>,
              },
            ]}
          />
        </Content>
        <Content
          style={{
            background: "#fff",
          }}
        >
          <Content
            style={{
              marginTop: 38,
              padding: 16,
              position: "fixed",
              zIndex: 10,
              borderTop: "1px solid #efefef",
              width: "calc(100vw - 380px)",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
                display: "flex",
                justifyContent: "space-between",
                flexDirection: "column",
              }}
            >
              <Space direction={"vertical"} size={16} style={{ width: "100%" }}>
                <Dragger
                  action={"/api/v1/content/upload"}
                  name={"files"}
                  showUploadList={true}
                  listType={"text"}
                  maxCount={100}
                  fileList={uploads}
                  multiple={true}
                  beforeUpload={async (file) => {
                    return file;
                  }}
                  onChange={(info) => {
                    let newFiles = info.fileList;

                    if (info.file.status === "done") {
                      console.log("Removing");
                      newFiles = info.fileList.filter((obj) => {
                        return obj.uid !== info.file.uid;
                      });
                    }

                    flushSync(() => {
                      setUploads(newFiles);
                    });
                  }}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <Typography.Text>
                    Click or drag files to this area to upload
                  </Typography.Text>
                </Dragger>
              </Space>
            </div>
          </Content>
        </Content>
      </Content>
    </ContentAuthWrapper>
  );
};

export default AssetUploadPage;
