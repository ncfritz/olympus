"use client";

import { Layout, Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import { consoleHref } from "../links";
import { consoleKey, type ConsoleKey, type Registry } from "../registry";

const { Sider } = Layout;
const { Text } = Typography;

export interface ControlSiderProps {
  nav: Registry;
  current: ConsoleKey;
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
 */
export const ControlSider = ({
  nav,
  current,
  origin,
  collapsed,
  onCollapse,
}: ControlSiderProps) => {
  const items: MenuProps["items"] = nav.map((property) => ({
    key: property.key,
    type: "group",
    label: property.label,
    children: property.consoles.map((entry) => {
      const key = consoleKey(property.key, entry.key);
      return {
        key,
        title: entry.description,
        // A plain anchor: every console is its own application.
        label: <a href={consoleHref(key, origin)}>{entry.label}</a>,
      };
    }),
  }));

  return (
    <Sider
      width={220}
      breakpoint="lg"
      collapsedWidth={0}
      collapsed={collapsed}
      onCollapse={onCollapse}
      trigger={null}
    >
      <div style={{ padding: "16px 24px" }}>
        <Text strong style={{ color: "#fff", whiteSpace: "nowrap" }}>
          Olympus Control
        </Text>
      </div>
      <Menu theme="dark" mode="inline" selectedKeys={[current]} items={items} />
    </Sider>
  );
};
