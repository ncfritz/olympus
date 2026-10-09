import type { ReactNode } from "react";

/**
 * One of the current console's own pages, in the sider beside the rail.
 *
 * The icon is not optional: collapsed, it is the whole of the row, and a
 * row that cannot be seen is not a way in.
 */
export interface ShellPage {
  /** Matched against `activePage`; the console's route is the obvious choice. */
  key: string;
  /** The page's name. Plain content: the shell makes the row a link. */
  label: ReactNode;
  icon: ReactNode;
  /**
   * Where the page is. A section — one with `children` — is not a
   * destination and does not need one.
   */
  href?: string;
  /** The tooltip, which collapsed is the only name the row has. */
  title?: string;
  /** A section's pages. Collapsed, antd opens these as a flyout. */
  children?: ShellPage[];
}

/** A way in, on the sign-in screen. */
export interface SignInProvider {
  /** The agent's OIDC provider name, as registered: `google`. */
  name: string;
  label: string;
  icon?: ReactNode;
}
