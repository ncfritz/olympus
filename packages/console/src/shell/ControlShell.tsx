"use client";

import { Flex, Layout, Spin, theme } from "antd";
import { useEffect, useState, type ReactNode } from "react";
import type { ConsoleAuth } from "../auth/useConsoleAuth";
import {
  findConsole,
  PROPERTIES,
  type ConsoleKey,
  type Registry,
} from "../registry";
import { breadcrumbItems } from "./breadcrumbs";
import { ConsoleRail } from "./ConsoleRail";
import { ControlHeader } from "./ControlHeader";
import { loadPagesCollapsed, savePagesCollapsed } from "./pagesCollapsed";
import { PagesSider } from "./PagesSider";
import { SignInCard } from "./SignInCard";
import type { ShellPage, SignInProvider } from "./types";

const { Content } = Layout;

/** What the chrome is called where it is not a particular console. */
const SUITE = "Olympus Control";

export interface ControlShellProps {
  /** The consoles this host runs, from `readShellConfig`. */
  nav: Registry;
  /** Which one this is: `minerva/calendar`. The suite's index is none of them. */
  current?: ConsoleKey;
  /** Where the suite is, if not this origin (CONTROL_ORIGIN). */
  origin?: string;
  /** The session, from `useConsoleAuth`. The index has no agent to have one with. */
  auth?: ConsoleAuth;
  /** This console's own pages, for the sider beside the rail. */
  pages?: ShellPage[];
  activePage?: string;
  /** Routes within the console. Without it a page is a document load. */
  onNavigate?: (href: string) => void;
  /** Console-specific header controls, to the left of the session menu. */
  actions?: ReactNode;
  /** The suite's wordmark for the header, served by the application. */
  logo?: ReactNode;
  signIn?: SignInProvider[];
  children: ReactNode;
}

/**
 * The chrome every console wears (ADR 0021), arranged as the main
 * Olympus site is: the suite across the top, its consoles in a fixed
 * rail, and this console's pages in the collapsible sider beside it.
 *
 * It routes nothing and fetches nothing — the console passes its pages
 * and its session in.
 */
export const ControlShell = ({
  nav,
  current,
  origin,
  auth,
  pages = [],
  activePage,
  onNavigate,
  actions,
  logo,
  signIn = [],
  children,
}: ControlShellProps) => {
  // Per browser rather than per render: crossing the suite is a document
  // load, and a sider that springs open each time is not a choice.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => setCollapsed(loadPagesCollapsed()), []);
  const collapsePages = (next: boolean) => {
    setCollapsed(next);
    savePagesCollapsed(next);
  };

  const { token } = theme.useToken();

  // The host's list can leave this console out — a misconfiguration, but
  // not a reason to render nothing, so the name comes from the full
  // registry and the rail shows whatever the host allowed.
  const here = current
    ? (findConsole(nav, current) ?? findConsole(PROPERTIES, current))
    : undefined;
  const title = here
    ? `${here.property.label} · ${here.console.label}`
    : (current ?? SUITE);

  if (auth?.status === "loading") {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (auth?.status === "unauthenticated") {
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
      <ControlHeader
        logo={logo}
        crumbs={breadcrumbItems({ nav, current, origin, pages, activePage })}
        actions={actions}
        email={auth?.email}
        onLogout={() => void auth?.logout()}
      />
      <Layout>
        <ConsoleRail nav={nav} current={current} origin={origin} />
        {pages.length > 0 ? (
          <PagesSider
            pages={pages}
            activePage={activePage}
            collapsed={collapsed}
            onCollapse={collapsePages}
            onNavigate={onNavigate}
          />
        ) : null}
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
