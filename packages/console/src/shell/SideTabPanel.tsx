"use client";

import { Layout, Tabs, type TabsProps } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import styles from "./SideTabPanel.module.css";

const { Content, Sider } = Layout;

/** The width of the tab bar alone, as the panel is when closed. */
const COLLAPSED_WIDTH = 62;

const storageKey = (panelId: string) => `olympus:sidePanel:${panelId}`;

const loadExpanded = (panelId: string): boolean | undefined => {
  try {
    const stored = window.localStorage.getItem(storageKey(panelId));
    return stored === null ? undefined : stored === "true";
  } catch {
    return undefined;
  }
};

const saveExpanded = (panelId: string, expanded: boolean): void => {
  try {
    window.localStorage.setItem(storageKey(panelId), String(expanded));
  } catch {
    // Best-effort: blocked storage only means the choice isn't kept.
  }
};

export interface SideTabPanelProps {
  /** Names the panel, so whether it is open is kept per browser. */
  panelId: string;
  /** The tabs: an icon each for a label, as the site's panels have. */
  tabs: TabsProps["items"];
  /** Its width when open, tab bar included. */
  width: number;
  /** Open until it is first closed; otherwise closed until first opened. */
  defaultExpanded?: boolean;
  /** The page beside it. */
  children: ReactNode;
  className?: string;
}

/**
 * A page with a panel of tabs down its right-hand side, as the main
 * site's Minerva calendar views have (apps/site, CollapsibleTabPanel):
 * the tab bar stays, a tab opens the panel, and the bar across its top
 * closes it again. The page and the panel scroll separately.
 */
export function SideTabPanel({
  panelId,
  tabs,
  width,
  defaultExpanded = false,
  children,
  className,
}: SideTabPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Read after mounting: the server renders the default.
  useEffect(() => {
    const stored = loadExpanded(panelId);
    if (stored !== undefined) setExpanded(stored);
  }, [panelId]);
  const expand = (open: boolean) => {
    setExpanded(open);
    saveExpanded(panelId, open);
  };

  return (
    <Layout
      className={`${styles.panel} ${expanded ? styles.expanded : styles.collapsed} ${className ?? ""}`}
    >
      <Content className={styles.main}>{children}</Content>
      <Sider
        theme="light"
        className={styles.sider}
        collapsible
        collapsed={!expanded}
        collapsedWidth={COLLAPSED_WIDTH}
        reverseArrow
        width={width}
        onCollapse={(collapsed) => expand(!collapsed)}
      >
        <Tabs
          className={styles.tabs}
          tabPlacement="end"
          items={tabs}
          onTabClick={() => expand(true)}
        />
      </Sider>
    </Layout>
  );
}
