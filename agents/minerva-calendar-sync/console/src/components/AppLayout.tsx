"use client";

import { GoogleOutlined, SettingOutlined } from "@ant-design/icons";
import {
  ControlShell,
  useConsoleAuth,
  type Registry,
} from "@ncfritz/olympus-console";
import { Button, Drawer, Flex, Select, Space, Switch, Typography } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { API_URL, CONSOLE_KEY } from "@/lib/api/client";
import {
  TimelineSettingsProvider,
  useTimelineSettings,
} from "@/lib/TimelineSettingsContext";
import { defaultTimelineSettings } from "@/lib/settings";

/** This console's own pages, in the shell's header strip. */
const TABS = [
  { key: "/", label: <Link href="/">Events</Link> },
  { key: "/calendars", label: <Link href="/calendars">Calendars</Link> },
  { key: "/sync", label: <Link href="/sync">Sync</Link> },
  { key: "/publish", label: <Link href="/publish">Publish</Link> },
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

export interface AppLayoutProps {
  /** The suite, as this host runs it, from the root layout. */
  nav: Registry;
  origin?: string;
  children: ReactNode;
}

/**
 * This console inside the shared chrome (ADR 0021): the suite's sider and
 * the session come from `@ncfritz/olympus-console`, the four pages and
 * the calendar settings are Minerva's own. It wraps the root layout, so
 * the chrome is rendered once rather than per page.
 */
export function AppLayout({ nav, origin, children }: AppLayoutProps) {
  const auth = useConsoleAuth({ apiUrl: API_URL });
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <TimelineSettingsProvider>
      <ControlShell
        nav={nav}
        current={CONSOLE_KEY}
        origin={origin}
        auth={auth}
        tabs={TABS}
        activeTab={
          ["/calendars", "/sync", "/publish"].includes(pathname)
            ? pathname
            : "/"
        }
        actions={
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => setSettingsOpen(true)}
            aria-label="Calendar settings"
            style={{ color: "#fff" }}
          />
        }
        signIn={[
          {
            name: "google",
            label: "Sign in with Google",
            icon: <GoogleOutlined />,
          },
        ]}
      >
        {children}
      </ControlShell>
      <TimelineSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
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
