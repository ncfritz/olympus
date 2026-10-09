"use client";

import { HomeOutlined } from "@ant-design/icons";
import { Space } from "antd";
import type { BreadcrumbProps } from "antd";
import type { ReactNode } from "react";
import { consoleHref } from "../links";
import {
  findConsole,
  PROPERTIES,
  type ConsoleKey,
  type Registry,
} from "../registry";
import { consoleIcon } from "./icons";
import type { ShellPage } from "./types";

/** The pages from the console's list down to `key`, outermost first. */
export const pageTrail = (
  pages: ShellPage[],
  key: string | undefined,
): ShellPage[] => {
  if (!key) return [];
  for (const page of pages) {
    if (page.key === key) return [page];
    const below = pageTrail(page.children ?? [], key);
    if (below.length) return [page, ...below];
  }
  return [];
};

const crumb = (icon: ReactNode, label: ReactNode): ReactNode => (
  <Space size={6}>
    {icon}
    {label}
  </Space>
);

export interface TrailOptions {
  nav: Registry;
  current?: ConsoleKey;
  origin?: string;
  pages: ShellPage[];
  activePage?: string;
}

/**
 * Where you are, as the main Olympus site says it: the suite, then the
 * property, then the console, then the page.
 *
 * Nothing supplies this — it is read off what the shell was given
 * already, so a console gets its trail by naming its pages and which one
 * is open. The property is text rather than a link because a property is
 * not a page; the console is a link because it has an index.
 */
export const breadcrumbItems = ({
  nav,
  current,
  origin,
  pages,
  activePage,
}: TrailOptions): BreadcrumbProps["items"] => {
  const items: NonNullable<BreadcrumbProps["items"]> = [
    { title: crumb(<HomeOutlined />, "Control"), href: origin ?? "/" },
  ];

  // The host's list can leave this console out — a misconfiguration, not
  // a reason to stop saying where you are.
  const here = current
    ? (findConsole(nav, current) ?? findConsole(PROPERTIES, current))
    : undefined;

  if (here) {
    items.push({ title: here.property.label });
    items.push({
      title: crumb(consoleIcon(here.console.icon), here.console.label),
      href: consoleHref(current as ConsoleKey, origin),
    });
  } else if (current) {
    items.push({ title: current });
  }

  for (const page of pageTrail(pages, activePage)) {
    items.push({ title: crumb(page.icon, page.label) });
  }

  return items;
};
