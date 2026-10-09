"use client";

import {
  DesktopOutlined,
  DownOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
} from "@ant-design/icons";
import {
  Breadcrumb,
  Button,
  ConfigProvider,
  Dropdown,
  Layout,
  Segmented,
  Space,
} from "antd";
import type { BreadcrumbProps } from "antd";
import type { ReactNode } from "react";
import { useThemeMode } from "../theme/ThemeModeProvider";
import type { ThemeMode } from "../theme/themeMode";

const { Header } = Layout;

const THEME_MODE_OPTIONS: { value: ThemeMode; icon: ReactNode }[] = [
  { value: "light", icon: <SunOutlined /> },
  { value: "dark", icon: <MoonOutlined /> },
  { value: "system", icon: <DesktopOutlined /> },
];

/** The bar is dark whatever the theme resolves to, so its text is not. */
const ON_DARK = {
  Breadcrumb: {
    itemColor: "rgba(255, 255, 255, 0.65)",
    lastItemColor: "#fff",
    linkColor: "rgba(255, 255, 255, 0.65)",
    linkHoverColor: "#fff",
    separatorColor: "rgba(255, 255, 255, 0.45)",
    iconFontSize: 14,
  },
  Segmented: {
    trackBg: "rgba(255, 255, 255, 0.08)",
    itemColor: "rgba(255, 255, 255, 0.65)",
    itemHoverColor: "rgba(255, 255, 255, 0.85)",
    itemHoverBg: "rgba(255, 255, 255, 0.08)",
    itemSelectedBg: "rgba(255, 255, 255, 0.2)",
    itemSelectedColor: "#fff",
    itemActiveBg: "rgba(255, 255, 255, 0.25)",
  },
};

export interface ControlHeaderProps {
  /**
   * The suite's wordmark, at the head of the bar. An image of the
   * header's own height, passed by the application because it serves the
   * file; the shell has no public directory of its own.
   */
  logo?: ReactNode;
  /** Where you are, from `breadcrumbItems`. */
  crumbs?: BreadcrumbProps["items"];
  /** Console-specific controls, to the left of the session menu. */
  actions?: ReactNode;
  email?: string;
  onLogout: () => void;
}

/**
 * The bar across the top: the suite's mark, where you are, and who you
 * are. Navigation is not here — the rail holds the consoles and the
 * sider beside it holds this console's pages, which is how the main
 * Olympus site is arranged.
 */
export const ControlHeader = ({
  logo,
  crumbs,
  actions,
  email,
  onLogout,
}: ControlHeaderProps) => (
  <ConfigProvider theme={{ components: ON_DARK }}>
    <Header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
        // The wordmark bleeds to the edge, as the main site's does;
        // without one the bar is padded like any other.
        paddingInline: logo ? "0 16px" : 16,
      }}
    >
      {logo ? (
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {logo}
        </div>
      ) : null}
      {crumbs && crumbs.length > 0 ? (
        <Breadcrumb items={crumbs} style={{ flex: 1, minWidth: 0 }} />
      ) : (
        <div style={{ flex: 1 }} />
      )}
      <Space>
        {actions}
        <ThemeModeControl />
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
  </ConfigProvider>
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
