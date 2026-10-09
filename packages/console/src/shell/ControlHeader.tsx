"use client";

import {
  DesktopOutlined,
  DownOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
} from "@ant-design/icons";
import {
  Button,
  ConfigProvider,
  Dropdown,
  Layout,
  Menu,
  Segmented,
  Space,
  Typography,
} from "antd";
import type { ReactNode } from "react";
import { useThemeMode } from "../theme/ThemeModeProvider";
import type { ThemeMode } from "../theme/themeMode";
import type { ShellTab } from "./types";

const { Header } = Layout;
const { Text } = Typography;

const THEME_MODE_OPTIONS: { value: ThemeMode; icon: ReactNode }[] = [
  { value: "light", icon: <SunOutlined /> },
  { value: "dark", icon: <MoonOutlined /> },
  { value: "system", icon: <DesktopOutlined /> },
];

export interface ControlHeaderProps {
  /**
   * The suite's wordmark, at the head of the bar. An image of the header's
   * own height, passed by the application because it serves the file; the
   * shell has no public directory of its own.
   */
  logo?: ReactNode;
  /**
   * What this console is called, with its property: "Minerva · Calendar".
   * The suite's index has none — the sider already names the suite.
   */
  title?: string;
  tabs?: ShellTab[];
  activeTab?: string;
  actions?: ReactNode;
  email?: string;
  onLogout: () => void;
}

/**
 * The current console's own chrome: its pages, its controls, and the
 * session. Everything here belongs to the application that rendered it —
 * the part of the suite that is shared is in the sider.
 */
export const ControlHeader = ({
  logo,
  title,
  tabs,
  activeTab,
  actions,
  email,
  onLogout,
}: ControlHeaderProps) => (
  <Header
    style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      flexShrink: 0,
      // The wordmark bleeds to the edge, as the main site's does; without
      // one the bar is padded like any other.
      paddingInline: logo ? "0 16px" : 16,
    }}
  >
    {logo ? (
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        {logo}
      </div>
    ) : null}
    {title ? (
      <Text strong style={{ color: "#fff", whiteSpace: "nowrap" }}>
        {title}
      </Text>
    ) : null}
    {tabs && tabs.length > 0 ? (
      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={activeTab ? [activeTab] : []}
        items={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          title: tab.title,
        }))}
        style={{ flex: 1, minWidth: 0 }}
      />
    ) : (
      <div style={{ flex: 1 }} />
    )}
    <Space>
      {actions}
      {/* Scoped to this control rather than a global token override, so it
          reads as part of the dark bar — the same treatment the tab Menu
          gets from theme="dark". A transparent track keeps it matching the
          header whatever the algorithm resolves to. */}
      <ConfigProvider
        theme={{
          components: {
            Segmented: {
              trackBg: "rgba(255, 255, 255, 0.08)",
              itemColor: "rgba(255, 255, 255, 0.65)",
              itemHoverColor: "rgba(255, 255, 255, 0.85)",
              itemHoverBg: "rgba(255, 255, 255, 0.08)",
              itemSelectedBg: "rgba(255, 255, 255, 0.2)",
              itemSelectedColor: "#fff",
              itemActiveBg: "rgba(255, 255, 255, 0.25)",
            },
          },
        }}
      >
        <ThemeModeControl />
      </ConfigProvider>
      {email ? (
        <Dropdown
          menu={{
            items: [
              {
                key: "logout",
                label: "Log out",
                icon: <LogoutOutlined />,
                onClick: onLogout,
              },
            ],
          }}
        >
          <Button type="text" style={{ color: "#fff" }}>
            <Space size="small">
              {email}
              <DownOutlined style={{ fontSize: 10 }} />
            </Space>
          </Button>
        </Dropdown>
      ) : null}
    </Space>
  </Header>
);

const ThemeModeControl = () => {
  const { mode, setMode } = useThemeMode();
  return (
    <Segmented
      size="small"
      shape="round"
      aria-label="Theme"
      options={THEME_MODE_OPTIONS}
      value={mode}
      onChange={(value) => setMode(value as ThemeMode)}
    />
  );
};
