import { GoogleOutlined, WindowsOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";

export type Provider = "google" | "microsoft";

/** Icon + display name for each connected provider — extend as new connectors ship. Shared between CalendarAccountsPanel and PublishPage so both render providers identically. */
export const PROVIDER_META: Record<Provider, { label: string; icon: ReactNode }> = {
  google: { label: "Google", icon: <GoogleOutlined /> },
  microsoft: { label: "Microsoft 365", icon: <WindowsOutlined /> },
};
