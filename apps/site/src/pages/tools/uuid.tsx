import { AimOutlined, HomeOutlined, ToolOutlined } from "@ant-design/icons";
import { Card, Space, Splitter, Tabs, Typography } from "antd";
import Link from "next/link";
import React, { useState } from "react";
import OlympusBreadcrumbs from "../../components/layout/OlympusBreadcrumbs";
import UUIDDecoderPanel from "../../components/tools/uuid/UUIDDecoderPanel";
import UUIDInfoPanel from "../../components/tools/uuid/UUIDInfoPanel";
import UUIDRandomValuesPanel from "../../components/tools/uuid/UUIDRandomValuesPanel";
import UUIDV16Form from "../../components/tools/uuid/form/UUIDV16Form";
import UUIDV35Form from "../../components/tools/uuid/form/UUIDV35Form";
import UUIDV4Form from "../../components/tools/uuid/form/UUIDV4Form";
import UUIDV7Form from "../../components/tools/uuid/form/UUIDV7Form";

const IndexPage: React.FunctionComponent = () => {
  const [activeTab, setActiveTab] = useState("v1");
  const [activeInfoKey, setActiveInfoKey] = useState<string[]>(["v1"]);
  const [currentValue, setCurrentValue] = useState<string | undefined>(
    undefined,
  );

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
      <Splitter style={{ height: "calc(100vh - 92px)" }}>
        <Splitter.Panel style={{ paddingRight: 32 }}>
          <Typography.Title level={2} style={{ marginLeft: 16, marginTop: 16 }}>
            UUID Utilities
          </Typography.Title>
          <Space
            orientation={"vertical"}
            size={16}
            style={{
              margin: 16,
              width: "100%",
              height: "calc(100vh - 202px)",
            }}
          >
            <Space
              size={16}
              orientation={"vertical"}
              style={{ width: "100%", paddingRight: 16 }}
            >
              <Card
                title={"Random UUID"}
                styles={{ header: { background: "#fafafa" } }}
              >
                <UUIDRandomValuesPanel getInfo={setCurrentValue} />
              </Card>
              <Card
                title={"UUID Decoder"}
                styles={{
                  header: { background: "#fafafa" },
                }}
              >
                <UUIDDecoderPanel
                  input={currentValue}
                  setDocsVersion={setActiveInfoKey}
                  currentDocsVersion={activeInfoKey}
                />
              </Card>
              <Card
                title={"Bulk UUID Generator"}
                styles={{ header: { background: "#fafafa" } }}
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
                        <UUIDV16Form
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
                    {
                      label: "Version 6",
                      key: "tools-bulk-uuid-v6",
                      children: (
                        <UUIDV16Form
                          version={6}
                          getInfo={(value) => {
                            setCurrentValue(value);
                          }}
                        />
                      ),
                    },
                    {
                      label: "Version 7",
                      key: "tools-bulk-uuid-v7",
                      children: (
                        <UUIDV7Form getInfo={setCurrentValue} version={7} />
                      ),
                    },
                  ]}
                />
              </Card>
            </Space>
          </Space>
        </Splitter.Panel>
        <Splitter.Panel
          collapsible={false}
          style={{
            background: "#ffffff",
          }}
        >
          <Typography.Title level={2} style={{ marginLeft: 16, marginTop: 16 }}>
            About UUIDs
          </Typography.Title>
          <Space
            orientation={"vertical"}
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
        </Splitter.Panel>
      </Splitter>
    </>
  );
};

export default IndexPage;
