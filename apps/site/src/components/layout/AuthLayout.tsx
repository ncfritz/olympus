import {
  ApiOutlined,
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
import { useDispatch } from "react-redux";
import styled from "styled-components";
import DionysusMenu from "../../dionysus/layout/menu";
import { useAppSelector } from "../../redux/hooks";
import { toggleSubmenuExpanded } from "../../redux/slices/layoutSlice";
import MinervaMenu from "../minerva/layout/menu";
import TranscriptionButton from "../notes/TranscriptionButton";
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
  const dispatch = useDispatch();

  const submenuExpanded = useAppSelector(
    (state) => state.layout.submenuExpanded,
  );

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
        setApplicationMenu(<DionysusMenu />);
        break;
      case "tools":
        setApplicationMenu(<ToolsMenu />);
        break;
      case "minerva":
        setApplicationMenu(<MinervaMenu />);
        break;
      default:
        setApplicationMenu(undefined);
    }
  }, [router]);

  let menuWidth = 0;
  let leftMarginWidth = 80; // Account for main menu

  if (applicationMenu) {
    if (submenuExpanded) {
      menuWidth = 300;
    } else {
      menuWidth = 80;
    }
  }

  leftMarginWidth += menuWidth;

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
            zIndex: 600,
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
              {
                type: "divider",
              },
              {
                key: `documentation`,
                icon: <ApiOutlined />,
                label: "API Documentation",
                children: [
                  {
                    key: `/docs/olympus`,
                    icon: <ApiOutlined />,
                    label: "Olympus",
                  },
                  {
                    key: `/docs/dionysus`,
                    icon: <ApiOutlined />,
                    label: "Dionysus",
                  },
                  {
                    key: `/docs/minerva`,
                    icon: <ApiOutlined />,
                    label: "Minerva",
                  },
                ],
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
              v{process.env.version || "Un.know.n"}
            </Typography.Text>
          </Space>
        </Sider>
        {applicationMenu && (
          <Sider
            className={`olympus-menu ${submenuExpanded ? "expanded" : "collapsed"}`}
            width={menuWidth}
            collapsedWidth={80}
            style={{
              overflowX: "hidden",
              height: "calc(100vh - 64px)",
              position: "absolute",
              left: 80,
              backgroundColor: submenuExpanded ? "#ffffff" : "#324354",
            }}
            collapsible={true}
            collapsed={!submenuExpanded}
            onCollapse={(collapsed, type) => {
              dispatch(toggleSubmenuExpanded());
            }}
          >
            {applicationMenu}
          </Sider>
        )}
        <Content
          style={{
            overflow: "initial",
            marginLeft: leftMarginWidth,
          }}
        >
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
            <Content
              className={"main-content"}
              style={{
                width: `calc(100vw - ${leftMarginWidth}px)`,
              }}
            >
              {children}
            </Content>
          </Layout>
          <TranscriptionButton />
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
