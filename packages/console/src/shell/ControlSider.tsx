"use client";

import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Layout, Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import { consoleHref } from "../links";
import {
  consoleKey,
  type ConsoleEntry,
  type ConsoleKey,
  type PropertyEntry,
  type Registry,
} from "../registry";
import { consoleIcon } from "./icons";

const { Sider } = Layout;
const { Text } = Typography;

/**
 * Expanded, and the rail it collapses to. The same pair the main Olympus
 * site uses for its own submenu, so the two read as one product.
 */
export const SIDER_WIDTH = 300;
export const SIDER_RAIL = 80;

/** How far the trigger overlaps the sider's edge, as the site's does. */
const TRIGGER_SIZE = 24;

/** antd's Header, which the sider stands beside rather than under. */
const HEADER_HEIGHT = 64;

export interface ControlSiderProps {
  nav: Registry;
  current?: ConsoleKey;
  origin?: string;
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

/**
 * The suite's map: property, then console. It is rendered from the
 * registry, so it is identical in every console image — which is what
 * makes a cross-console click, a full document load, read as navigation
 * rather than a reload.
 *
 * Groups are always expanded. The whole suite is a dozen rows, so there
 * is nothing to gain by collapsing them and one more piece of state to
 * lose across that document load.
 *
 * Collapsed, it is the site's icon rail: the properties drop away, since
 * a group heading with no room for its text is worse than none, and each
 * console is its glyph and a tooltip.
 */
export const ControlSider = ({
  nav,
  current,
  origin,
  collapsed,
  onCollapse,
}: ControlSiderProps) => {
  const row = (property: PropertyEntry, entry: ConsoleEntry) => {
    const key = consoleKey(property.key, entry.key);
    const href = consoleHref(key, origin);
    const icon = consoleIcon(entry.icon);

    if (collapsed) {
      // The link goes in the icon's place because the icon is the whole
      // row here, and antd hides the label. Stretched over the row so the
      // target is the row rather than a 16px glyph, which is what the
      // label gets to be when there is room for it.
      return {
        key,
        title: `${property.label} · ${entry.label}`,
        icon: (
          <a
            href={href}
            aria-label={`${property.label} · ${entry.label}`}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "inherit",
            }}
          >
            {icon}
          </a>
        ),
      };
    }

    return {
      key,
      icon,
      title: entry.description,
      // A plain anchor: every console is its own application.
      label: <a href={href}>{entry.label}</a>,
    };
  };

  const items: MenuProps["items"] = collapsed
    ? nav.flatMap((property) =>
        property.consoles.map((entry) => row(property, entry)),
      )
    : nav.map((property) => ({
        key: property.key,
        type: "group",
        label: property.label,
        children: property.consoles.map((entry) => row(property, entry)),
      }));

  return (
    <Sider
      width={SIDER_WIDTH}
      breakpoint="lg"
      collapsedWidth={SIDER_RAIL}
      collapsed={collapsed}
      onCollapse={onCollapse}
      trigger={null}
      style={{ position: "relative" }}
    >
      {/* The header's own height, kept whether or not there is a wordmark
          in it: the list then starts level with the page beside it, and
          collapsing does not shunt it up. */}
      <div
        style={{
          height: HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          paddingInline: 24,
        }}
      >
        {collapsed ? null : (
          <Text strong style={{ color: "#fff", whiteSpace: "nowrap" }}>
            Olympus Control
          </Text>
        )}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={current ? [current] : []}
        items={items}
      />
      {/* The site's trigger: a pill straddling the sider's edge, at the
          height the eye is already at, rather than a bar at the foot of a
          full-height sider. antd's own is positioned by stylesheet and we
          have no stylesheet (README, Styles), so this is a plain button. */}
      <Button
        shape="circle"
        size="small"
        icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
        onClick={() => onCollapse(!collapsed)}
        aria-label={
          collapsed ? "Expand the console list" : "Collapse the console list"
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
