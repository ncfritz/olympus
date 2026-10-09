"use client";

import {
  ApiOutlined,
  BellOutlined,
  CalendarOutlined,
  CloudUploadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import type { ConsoleIconName } from "../registry";

/**
 * The registry's icon names, drawn. This is the only place the suite's
 * glyphs are chosen, so the sider's rail and the index agree about what a
 * console looks like, and `registry.ts` stays data a server can read.
 */
const ICONS: Record<ConsoleIconName, ReactNode> = {
  calendar: <CalendarOutlined />,
  certificate: <SafetyCertificateOutlined />,
  deploy: <CloudUploadOutlined />,
  notification: <BellOutlined />,
  console: <ApiOutlined />,
};

export const consoleIcon = (name: ConsoleIconName): ReactNode => ICONS[name];
