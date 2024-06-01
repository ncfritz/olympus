import { AimOutlined, HomeOutlined, ToolOutlined } from "@ant-design/icons";
import { Breadcrumb, Card, Layout, Space, Tabs, Typography } from "antd";
import Link from "next/link";
import React, { useState } from "react";
import UUIDDecoderPanel from "../../components/tools/uuid/UUIDDecoderPanel";
import UUIDInfoPanel from "../../components/tools/uuid/UUIDInfoPanel";
import UUIDRandomValuesPanel from "../../components/tools/uuid/UUIDRandomValuesPanel";
import UUIDV1Form from "../../components/tools/uuid/UUIDV1Form";
import UUIDV35Form from "../../components/tools/uuid/UUIDV35Form";
import UUIDV4Form from "../../components/tools/uuid/UUIDV4Form";

const { Sider, Content } = Layout;

const IndexPage: React.FunctionComponent = () => {
  const [activeTab, setActiveTab] = useState("v1");
  const [activeInfoKey, setActiveInfoKey] = useState<string[]>(["v1"]);
  const [currentValue, setCurrentValue] = useState<string | undefined>(
    undefined,
  );

  return (
    <div>
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
              <Link href={"/tools"}>
                <Space size={4}>
                  <ToolOutlined />
                  <span>Tools</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space>
                <AimOutlined />
                <span>UUIDs</span>
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
        <Content style={{ width: "calc(100vw - 1146px)" }}>
          <Typography.Title level={2} style={{ marginLeft: 16, marginTop: 16 }}>
            UUID Utilities
          </Typography.Title>
          <Space
            direction={"vertical"}
            size={16}
            style={{
              margin: 16,
              position: "fixed",
              height: "calc(100vh - 202px)",
              width: "calc(100vw - 1164px)",
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            <Space
              size={16}
              direction={"vertical"}
              style={{ width: "100%", paddingRight: 16 }}
            >
              <Card title={"Random UUID"} headStyle={{ background: "#fafafa" }}>
                <UUIDRandomValuesPanel getInfo={setCurrentValue} />
              </Card>
              <Card
                title={"UUID Decoder"}
                headStyle={{ background: "#fafafa" }}
              >
                <UUIDDecoderPanel
                  input={currentValue}
                  setDocsVersion={setActiveInfoKey}
                  currentDocsVersion={activeInfoKey}
                />
              </Card>
              <Card
                title={"Bulk UUID Generator"}
                headStyle={{ background: "#fafafa" }}
              >
                <Tabs
                  tabPosition={"left"}
                  onChange={(key) => {
                    const version = key.substring(key.lastIndexOf("-") + 1);
                    let infoKey = version;

                    if (version === "v3" || version === "v5") {
                      infoKey = "v35";
                    }

                    setActiveTab(infoKey);
                    setActiveInfoKey([infoKey]);
                  }}
                  onClick={() => {
                    if (activeInfoKey.indexOf(activeTab) === -1) {
                      setActiveInfoKey([activeTab]);
                    }
                  }}
                  items={[
                    {
                      label: "Version 1",
                      key: "tools-bulk-uuid-v1",
                      children: (
                        <UUIDV1Form
                          version={1}
                          getInfo={(value) => {
                            setCurrentValue(value);
                          }}
                        />
                      ),
                    },
                    {
                      label: "Version 3",
                      key: "tools-bulk-uuid-v3",
                      children: (
                        <UUIDV35Form getInfo={setCurrentValue} version={3} />
                      ),
                    },
                    {
                      label: "Version 4",
                      key: "tools-bulk-uuid-v4",
                      children: (
                        <UUIDV4Form getInfo={setCurrentValue} version={4} />
                      ),
                    },
                    {
                      label: "Version 5",
                      key: "tools-bulk-uuid-v5",
                      children: (
                        <UUIDV35Form getInfo={setCurrentValue} version={5} />
                      ),
                    },
                  ]}
                />
              </Card>
            </Space>
          </Space>
        </Content>
        <Sider
          width={750}
          collapsible={false}
          style={{
            background: "#ffffff",
            marginRight: 16,
            top: 102,
            right: 0,
            position: "fixed",
            height: "calc(100vh - 104px)",
            borderLeft: "1px solid #f0f0f0",
          }}
        >
          <Typography.Title level={2} style={{ marginLeft: 16, marginTop: 16 }}>
            About UUIDs
          </Typography.Title>
          <Space
            direction={"vertical"}
            size={16}
            style={{
              position: "fixed",
              overflowY: "auto",
              overflowX: "hidden",
              height: "calc(100vh - 176px)",
            }}
          >
            <UUIDInfoPanel
              activeInfoKey={activeInfoKey}
              setActiveInfoKey={setActiveInfoKey}
            />
          </Space>
        </Sider>
      </Layout>
    </div>
  );
};

export default IndexPage;
