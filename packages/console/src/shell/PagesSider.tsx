"use client";

import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Layout, Menu, theme } from "antd";
import type { MenuProps } from "antd";
import { PageLink } from "./pageLink";
import type { ShellPage } from "./types";

const { Sider } = Layout;

/** Open, and the rail it collapses to — the main Olympus site's pair. */
export const PAGES_WIDTH = 300;
export const PAGES_RAIL = 80;

/** The pill straddling the sider's edge, as the site's does. */
const TRIGGER_SIZE = 24;

/** Both menus start here, so the first rows sit level across the two. */
export const MENU_INSET = 8;

/**
 * Collapsed, the sider is a second rail and wants to be read against the
 * console rail rather than the page. The chrome is one colour whatever
 * the theme algorithm resolves to (see ThemeModeProvider), and this is
 * the site's own step between the two.
 */
const RAIL_BG = "#324354";

export interface PagesSiderProps {
  pages: ShellPage[];
  activePage?: string;
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  /** Routes within the console. Without it a page is a document load. */
  onNavigate?: (href: string) => void;
}

/**
 * The current console's own pages. Open it is a light panel, the way the
 * main Olympus site's submenu is; collapsed it is a rail of glyphs, with
 * sections opening as flyouts because there is no room to nest.
 *
 * It renders nothing of its own: the pages come from the console, which
 * is the only thing that knows what they are.
 */
export const PagesSider = ({
  pages,
  activePage,
  collapsed,
  onCollapse,
  onNavigate,
}: PagesSiderProps) => {
  const { token } = theme.useToken();

  const toItem = (page: ShellPage): NonNullable<MenuProps["items"]>[number] => {
    const children = page.children?.map(toItem);

    // A section is not a destination; only a leaf has somewhere to go.
    if (children?.length) {
      return { key: page.key, icon: page.icon, label: page.label, children };
    }

    if (!page.href) {
      return { key: page.key, icon: page.icon, label: page.label };
    }

    // Collapsed, the glyph is the whole row and antd hides the label, so
    // the link moves into the glyph's place and is stretched over it.
    return collapsed
      ? {
          key: page.key,
          title: page.title ?? undefined,
          icon: (
            <PageLink
              href={page.href}
              onNavigate={onNavigate}
              fill
              label={page.title}
            >
              {page.icon}
            </PageLink>
          ),
        }
      : {
          key: page.key,
          icon: page.icon,
          title: page.title,
          label: (
            <PageLink href={page.href} onNavigate={onNavigate}>
              {page.label}
            </PageLink>
          ),
        };
  };

  return (
    <Sider
      width={PAGES_WIDTH}
      collapsedWidth={PAGES_RAIL}
      collapsed={collapsed}
      collapsible={false}
      trigger={null}
      style={{
        position: "relative",
        background: collapsed ? RAIL_BG : token.colorBgContainer,
        // Open, the panel is the same colour as the page it sits beside,
        // so it needs an edge to be a panel at all. Collapsed it is its
        // own edge.
        borderInlineEnd: collapsed
          ? undefined
          : `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Menu
        theme={collapsed ? "dark" : "light"}
        mode="inline"
        selectedKeys={activePage ? [activePage] : []}
        items={pages.map(toItem)}
        style={{
          background: "transparent",
          // The sider draws the edge; a second one down the same line
          // reads as a seam.
          borderInlineEnd: "none",
          paddingBlockStart: MENU_INSET,
        }}
      />
      {/* The site's trigger: a pill on the edge at the height the eye is
          already at, rather than a bar at the foot of a full-height
          sider. antd's own is positioned by stylesheet and this package
          has none (README, Styles), so this is a plain button. */}
      <Button
        shape="circle"
        size="small"
        icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
        onClick={() => onCollapse(!collapsed)}
        aria-label={
          collapsed ? "Expand the page list" : "Collapse the page list"
        }
        aria-expanded={!collapsed}
        style={{
          position: "absolute",
          top: "50%",
          right: -TRIGGER_SIZE / 2,
          width: TRIGGER_SIZE,
          height: TRIGGER_SIZE,
          minWidth: TRIGGER_SIZE,
          transform: "translateY(-50%)",
          zIndex: 1,
        }}
      />
    </Sider>
  );
};
