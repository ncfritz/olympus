"use client";

import {
  DesktopOutlined,
  DownOutlined,
  GoogleOutlined,
  LogoutOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  ConfigProvider,
  Drawer,
  Dropdown,
  Flex,
  Layout,
  Menu,
  Radio,
  Select,
  Space,
  Spin,
  Switch,
  theme,
  Typography,
} from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { loginUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/use-auth";
import { useThemeMode } from "@/lib/ThemeModeContext";
import {
  TimelineSettingsProvider,
  useTimelineSettings,
} from "@/lib/TimelineSettingsContext";
import { defaultTimelineSettings } from "@/lib/settings";
import type { ThemeMode } from "@/lib/theme";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const NAV_ITEMS = [
  { key: "/", label: <Link href="/">Events</Link> },
  { key: "/calendars", label: <Link href="/calendars">Calendars</Link> },
  { key: "/sync", label: <Link href="/sync">Sync</Link> },
];

const THEME_MODE_OPTIONS: { value: ThemeMode; label: ReactNode; title: string }[] = [
  { value: "light", label: <SunOutlined />, title: "Light" },
  { value: "dark", label: <MoonOutlined />, title: "Dark" },
  { value: "system", label: <DesktopOutlined />, title: "System" },
];

/** Falls back to just the browser's own zone if the (widely, but not universally, supported) enumeration API isn't available. */
const TIMEZONE_OPTIONS: { value: string; label: string }[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone").map((tz) => ({
      value: tz,
      label: tz,
    }));
  } catch {
    return [
      {
        value: defaultTimelineSettings().timezone,
        label: defaultTimelineSettings().timezone,
      },
    ];
  }
})();

export function AppLayout({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode, setMode } = useThemeMode();
  const { token } = theme.useToken();

  if (auth.status === "loading") {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (auth.status === "unauthenticated") {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Card style={{ width: 360, textAlign: "center" }}>
          <Title level={3}>Minerva Calendar Sync</Title>
          <Text type="secondary">
            Sign in to view your synced calendars and events.
          </Text>
          <div style={{ marginTop: 24 }}>
            <a href={loginUrl("google")}>
              <Button type="primary" icon={<GoogleOutlined />} size="large">
                Sign in with Google
              </Button>
            </a>
          </div>
        </Card>
      </Flex>
    );
  }

  return (
    <TimelineSettingsProvider>
      <Layout style={{ height: "100vh", overflow: "hidden" }}>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexShrink: 0,
          }}
        >
          <Title
            level={4}
            style={{ color: "white", margin: 0, whiteSpace: "nowrap" }}
          >
            Minerva Calendar Sync
          </Title>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[
              pathname === "/calendars" ? "/calendars" : pathname === "/sync" ? "/sync" : "/",
            ]}
            items={NAV_ITEMS}
            style={{ flex: 1, minWidth: 0 }}
          />
          <Space>
            {/* Scoped to just this control (not a global colorPrimary/colorBorder
                override) so it reads as part of the dark header bar — same
                treatment the nav Menu above gets via its own theme="dark" — rather
                than as a separate light-themed widget sitting on top of it. A
                transparent button background (vs. a hardcoded hex) keeps it
                exactly matching the header regardless of theme/algorithm. */}
            <ConfigProvider
              theme={{
                components: {
                  Radio: {
                    buttonBg: "transparent",
                    buttonColor: "rgba(255, 255, 255, 0.65)",
                    buttonCheckedBg: "rgba(255, 255, 255, 0.15)",
                    colorBorder: "rgba(255, 255, 255, 0.25)",
                    colorPrimary: "#fff",
                    colorPrimaryHover: "#fff",
                    colorPrimaryActive: "#fff",
                  },
                },
              }}
            >
              <Radio.Group
                size="small"
                optionType="button"
                options={THEME_MODE_OPTIONS}
                value={mode}
                onChange={(e) => setMode(e.target.value as ThemeMode)}
              />
            </ConfigProvider>
            <Dropdown
              menu={{
                items: [
                  {
                    key: "logout",
                    label: "Log out",
                    icon: <LogoutOutlined />,
                    onClick: () => auth.logout(),
                  },
                ],
              }}
            >
              <Button type="text" style={{ color: "white" }}>
                <Space size="small">
                  {auth.email}
                  <DownOutlined style={{ fontSize: 10 }} />
                </Space>
              </Button>
            </Dropdown>
            <Button
              type="text"
              style={{ color: "white" }}
              icon={<SettingOutlined />}
              onClick={() => setSettingsOpen(true)}
              aria-label="Calendar settings"
            />
          </Space>
        </Header>
        <Content
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            // Matches Table/Card's own background (colorBgContainer) rather
            // than Layout's default colorBgLayout, so the page background
            // isn't a subtly different shade from the panels sitting on it.
            background: token.colorBgContainer,
          }}
        >
          {children}
        </Content>
        <TimelineSettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </Layout>
    </TimelineSettingsProvider>
  );
}

function TimelineSettingsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { settings, updateSettings } = useTimelineSettings();

  return (
    <Drawer title="Calendar Settings" open={open} onClose={onClose} size={360}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Working hours
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Controls the status timeline strip on the week/day calendar views:
        outside these hours (or on a weekend, unless shown below), only an
        override shows through.
      </Typography.Paragraph>
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <Flex justify="space-between" align="center">
          <Typography.Text>Day start</Typography.Text>
          <input
            type="time"
            value={settings.dayStart}
            onChange={(e) => updateSettings({ dayStart: e.target.value })}
          />
        </Flex>
        <Flex justify="space-between" align="center">
          <Typography.Text>Day end</Typography.Text>
          <input
            type="time"
            value={settings.dayEnd}
            onChange={(e) => updateSettings({ dayEnd: e.target.value })}
          />
        </Flex>
        <Flex justify="space-between" align="center">
          <Typography.Text>Show status during weekends</Typography.Text>
          <Switch
            checked={settings.treatWeekendsAsWorking}
            onChange={(checked) =>
              updateSettings({ treatWeekendsAsWorking: checked })
            }
          />
        </Flex>
        <div>
          <Typography.Text>Timezone</Typography.Text>
          <Select
            showSearch
            style={{ width: "100%", marginTop: 4 }}
            value={settings.timezone}
            options={TIMEZONE_OPTIONS}
            onChange={(timezone) => updateSettings({ timezone })}
          />
        </div>
      </Space>
    </Drawer>
  );
}
