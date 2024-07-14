import {
  AmazonOutlined,
  EditOutlined,
  HeartOutlined,
  HomeOutlined,
  MoneyCollectOutlined,
  ToolOutlined,
  UpOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { FloatButton, Layout, Menu, Space, Typography } from "antd";
import { useRouter } from "next/router";
import { type ReactNode, useEffect, useState } from "react";
import styled from "styled-components";
import DionysysMenu from "../../dionysus/layout/menu";
import MinervaMenu from "../minerva/layout/menu";
import ThemisMenu from "../themis/layout/menu";
import ToolsMenu from "../tools/layout/menu";
import AuthHeader from "./AuthHeader";

const { Content, Sider } = Layout;

const BackToTopButton = styled.div`
  position: fixed;
  right: 48px;
  background: #888;
  padding: 12px;
  color: #fff;
  border-radius: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;

  &:hover {
    background: #efefef;
    color: #1890ff;
    border: 2px solid #1890ff;
  }
`;

export interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FunctionComponent<AuthLayoutProps> = ({ children }) => {
  const router = useRouter();

  const [menuItem, setMenuItem] = useState<string>("/");
  const [applicationMenu, setApplicationMenu] = useState<ReactNode | undefined>(
    undefined,
  );

  useEffect(() => {
    const path = router.pathname;
    const application = path.split("/")[1];
    setMenuItem(`/${application}`);

    switch (application) {
      case "dionysus":
        setApplicationMenu(<DionysysMenu />);
        break;
      case "tools":
        setApplicationMenu(<ToolsMenu />);
        break;
      case "minerva":
        setApplicationMenu(<MinervaMenu />);
        break;
      case "themis":
        setApplicationMenu(<ThemisMenu />);
        break;
      default:
        setApplicationMenu(undefined);
    }
  }, [router]);

  return (
    <Layout>
      <AuthHeader />
      <Layout
        style={{ position: "relative", top: 64, backgroundColor: "#ffffff" }}
      >
        <Sider
          className={"olympus-main-menu"}
          style={{
            overflow: "auto",
            height: "100vh",
            position: "fixed",
            top: 64,
            left: 0,
          }}
          collapsible={false}
          collapsed={true}
        >
          <Menu
            theme={"dark"}
            defaultSelectedKeys={["/"]}
            selectedKeys={[menuItem]}
            onSelect={({ item, key, keyPath, selectedKeys, domEvent }) => {
              setMenuItem(key);
              router.push(key, key, { shallow: true });
            }}
            items={[
              {
                key: "/",
                icon: <HomeOutlined />,
                label: "Home",
              },
              {
                key: "/minerva",
                icon: <EditOutlined />,
                label: "Minerva",
              },
              {
                key: "/themis",
                icon: <AmazonOutlined />,
                label: "Themis",
              },
              {
                key: "/dionysus",
                icon: <VideoCameraOutlined />,
                label: "Dionysus",
              },
              {
                key: "/tools",
                icon: <ToolOutlined />,
                label: "Tools",
              },
              {
                key: "/health",
                icon: <HeartOutlined />,
                label: "Health",
              },
              {
                key: "/finance",
                icon: <MoneyCollectOutlined />,
                label: "Finance",
              },
            ]}
          />
          <Space
            direction={"vertical"}
            style={{
              textAlign: "center",
              width: "100%",
              position: "relative",
              bottom: 64,
              padding: 8,
            }}
          >
            <Typography.Text
              style={{
                color: "#909293",
                fontSize: 10,
              }}
            >
              v{process.env.version || "U.know.n"}
            </Typography.Text>
          </Space>
        </Sider>
        {applicationMenu && (
          <Sider
            width={300}
            style={{
              overflow: "auto",
              height: "100vh",
              position: "fixed",
              top: 64,
              left: 80,
              backgroundColor: "#ffffff",
              borderRight: "1px solid #0505050f",
            }}
          >
            {applicationMenu}
          </Sider>
        )}
        <Content
          style={{
            overflow: "initial",
            marginLeft: applicationMenu ? 380 : 80,
          }}
        >
          <div className={"main"}>{children}</div>
          <FloatButton.BackTop visibilityHeight={600}>
            <BackToTopButton>
              <UpOutlined />
            </BackToTopButton>
          </FloatButton.BackTop>
        </Content>
      </Layout>
    </Layout>
  );
};
export default AuthLayout;
