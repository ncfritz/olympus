"use client";

import { HomeOutlined } from "@ant-design/icons";
import { Layout, Menu } from "antd";
import type { MenuProps } from "antd";
import type { ReactNode } from "react";
import { consoleHref } from "../links";
import { consoleKey, type ConsoleKey, type Registry } from "../registry";
import { consoleIcon } from "./icons";
import { PageLink } from "./pageLink";
import { MENU_INSET } from "./PagesSider";

const { Sider } = Layout;

/** The rail's width, as the main Olympus site's. */
export const RAIL_WIDTH = 80;

/** The suite's index, which is no console and so is not in the registry. */
const INDEX_KEY = "control";

export interface ConsoleRailProps {
  nav: Registry;
  current?: ConsoleKey;
  origin?: string;
}

/**
 * Every console the host runs, as a glyph: Control, then the consoles in
 * registry order. It does not collapse and it does not scroll away — it
 * is the one thing on screen that is the same in every console image,
 * which is what makes a cross-console click, a full document load, read
 * as navigation rather than a reload.
 *
 * The properties are not rows. They are how a console is *named*
 * (`minerva/calendar`, and so its path, image and metrics client), not
 * anywhere a person can go, and a rail is too narrow to say both. The
 * tooltip carries the property, for the day two of them have a Calendar.
 */
export const ConsoleRail = ({ nav, current, origin }: ConsoleRailProps) => {
  const row = (key: string, name: string, icon: ReactNode, href: string) => ({
    key,
    icon: (
      <PageLink href={href} fill label={name}>
        {icon}
      </PageLink>
    ),
    title: name,
  });

  const items: MenuProps["items"] = [
    row(INDEX_KEY, "Olympus Control", <HomeOutlined />, origin ?? "/"),
    ...nav.flatMap((property) =>
      property.consoles.map((entry) => {
        const key = consoleKey(property.key, entry.key);
        return row(
          key,
          `${property.label} · ${entry.label}`,
          consoleIcon(entry.icon),
          consoleHref(key, origin),
        );
      }),
    ),
  ];

  return (
    <Sider
      width={RAIL_WIDTH}
      collapsedWidth={RAIL_WIDTH}
      collapsed
      collapsible={false}
      trigger={null}
    >
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[current ?? INDEX_KEY]}
        items={items}
        style={{ paddingBlockStart: MENU_INSET }}
      />
    </Sider>
  );
};
