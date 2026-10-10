"use client";

import {
  AuditOutlined,
  DashboardOutlined,
  FileProtectOutlined,
  GoogleOutlined,
  KeyOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import {
  ControlShell,
  useConsoleAuth,
  type Registry,
  type ShellPage,
} from "@ncfritz/olympus-console";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { API_URL, BASE_PATH, CONSOLE_KEY } from "@/lib/api/client";
import styles from "./AppLayout.module.css";
import { SealedBanner } from "./SealedBanner";
import { SignerStatusTag } from "./SignerStatusTag";

/**
 * This console's own pages, in the sider beside the rail. The key is the
 * route, matched against the path; the href is the address, with the
 * base path the console is published under.
 */
const PAGES: ShellPage[] = [
  { key: "/", label: "Dashboard", icon: <DashboardOutlined />, href: "/" },
  {
    key: "cas",
    label: "CAs",
    icon: <ApartmentOutlined />,
    children: [
      {
        key: "/roots",
        label: "Roots",
        icon: <SafetyCertificateOutlined />,
        href: "/roots",
      },
      {
        key: "/ceremonies",
        label: "Ceremonies",
        icon: <KeyOutlined />,
        href: "/ceremonies",
      },
    ],
  },
  {
    key: "/certificates",
    label: "Certificates",
    icon: <FileProtectOutlined />,
    href: "/certificates",
  },
  {
    key: "/profiles",
    label: "Profiles",
    icon: <ProfileOutlined />,
    href: "/profiles",
  },
  { key: "/audit", label: "Audit", icon: <AuditOutlined />, href: "/audit" },
].map(withBasePath);

function withBasePath(page: ShellPage): ShellPage {
  return {
    ...page,
    href: page.href && `${BASE_PATH}${page.href}`,
    children: page.children?.map(withBasePath),
  };
}

/** Which page a route belongs to: a CA is one of the roots' pages, and so on. */
const activePageOf = (pathname: string): string => {
  if (pathname.startsWith("/roots") || pathname.startsWith("/ca")) {
    return "/roots";
  }
  if (pathname.startsWith("/ceremon")) return "/ceremonies";
  for (const page of ["/certificates", "/profiles", "/audit"]) {
    if (pathname.startsWith(page)) return page;
  }
  return "/";
};

export interface AppLayoutProps {
  /** The suite, as this host runs it, from the root layout. */
  nav: Registry;
  origin?: string;
  children: ReactNode;
}

/**
 * This console inside the shared chrome (ADR 0021): the suite's rail and
 * the session come from `@ncfritz/olympus-console`; the pages, the
 * signer's seal in the header and the sealed banner are Harpocrates's.
 */
export function AppLayout({ nav, origin, children }: AppLayoutProps) {
  const auth = useConsoleAuth({ apiUrl: API_URL });
  const pathname = usePathname();
  const router = useRouter();

  return (
    <ControlShell
      nav={nav}
      current={CONSOLE_KEY}
      origin={origin}
      auth={auth}
      pages={PAGES}
      activePage={activePageOf(pathname)}
      // The router takes the route, without the base path the anchor
      // carries for a new tab.
      onNavigate={(href) => router.push(href.slice(BASE_PATH.length) || "/")}
      actions={auth.status === "authenticated" ? <SignerStatusTag /> : null}
      signIn={[
        {
          name: "google",
          label: "Sign in with Google",
          icon: <GoogleOutlined />,
        },
      ]}
    >
      <SealedBanner />
      <div className={styles.page}>{children}</div>
    </ControlShell>
  );
}
