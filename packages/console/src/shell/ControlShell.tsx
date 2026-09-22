"use client";

import { Flex, Layout, Spin, theme } from "antd";
import { useState, type ReactNode } from "react";
import type { ConsoleAuth } from "../auth/useConsoleAuth";
import {
  findConsole,
  PROPERTIES,
  type ConsoleKey,
  type Registry,
} from "../registry";
import { ControlHeader } from "./ControlHeader";
import { ControlSider } from "./ControlSider";
import { SignInCard } from "./SignInCard";
import type { ShellTab, SignInProvider } from "./types";

const { Content } = Layout;

export interface ControlShellProps {
  /** The consoles this host runs, from `readShellConfig`. */
  nav: Registry;
  /** Which one this is: `minerva/calendar`. */
  current: ConsoleKey;
  /** Where the suite is, if not this origin (CONTROL_ORIGIN). */
  origin?: string;
  auth: ConsoleAuth;
  tabs?: ShellTab[];
  activeTab?: string;
  /** Console-specific header controls, to the left of the session menu. */
  actions?: ReactNode;
  signIn?: SignInProvider[];
  children: ReactNode;
}

/**
 * The chrome every console wears: the suite in the sider, the console's
 * own pages in the header (ADR 0021). It routes nothing and fetches
 * nothing — the console passes its tabs and its session in.
 */
export const ControlShell = ({
  nav,
  current,
  origin,
  auth,
  tabs,
  activeTab,
  actions,
  signIn = [],
  children,
}: ControlShellProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();

  // The host's list can leave this console out — a misconfiguration, but
  // not a reason to render nothing, so the name comes from the full
  // registry and the sider shows whatever the host allowed.
  const here = findConsole(nav, current) ?? findConsole(PROPERTIES, current);
  const title = here
    ? `${here.property.label} · ${here.console.label}`
    : current;

  if (auth.status === "loading") {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (auth.status === "unauthenticated") {
    return (
      <SignInCard
        title={title}
        providers={signIn}
        signInHref={auth.signInHref}
      />
    );
  }

  return (
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
      <ControlSider
        nav={nav}
        current={current}
        origin={origin}
        collapsed={collapsed}
        onCollapse={setCollapsed}
      />
      <Layout>
        <ControlHeader
          title={title}
          tabs={tabs}
          activeTab={activeTab}
          actions={actions}
          email={auth.email}
          onLogout={() => void auth.logout()}
          onToggleNav={() => setCollapsed((open) => !open)}
        />
        <Content
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            // Matches Card/Table's own background rather than Layout's
            // default, so panels don't sit on a subtly different shade.
            background: token.colorBgContainer,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};
