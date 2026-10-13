"use client";

import {
  ApiOutlined,
  AuditOutlined,
  CloudUploadOutlined,
  DashboardOutlined,
  FileProtectOutlined,
  GoogleOutlined,
  ProfileOutlined,
  ApartmentOutlined,
  CodeOutlined,
  IdcardOutlined,
  KeyOutlined,
  TeamOutlined,
  UserOutlined,
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
import { useCurrentUser } from "@/lib/api/queries";
import styles from "./AppLayout.module.css";
import { SealedBanner } from "./SealedBanner";
import { SignerStatusTag } from "./SignerStatusTag";

/**
 * This console's own pages, in the sider beside the rail. The key is the
 * route, matched against the path; the href is the address, with the
 * base path the console is published under.
 */
const MY_SSH: ShellPage = {
  key: "/ssh/mine",
  label: "My SSH certificate",
  icon: <UserOutlined />,
  href: "/ssh/mine",
};

const PAGES: ShellPage[] = [
  { key: "/", label: "Dashboard", icon: <DashboardOutlined />, href: "/" },
  {
    key: "/roots",
    label: "Roots",
    icon: <ApartmentOutlined />,
    href: "/roots",
  },
  {
    key: "/certificates",
    label: "Certificates",
    icon: <FileProtectOutlined />,
    href: "/certificates",
  },
  {
    key: "/deploy-targets",
    label: "Deploy targets",
    icon: <CloudUploadOutlined />,
    href: "/deploy-targets",
  },
  {
    key: "/acme",
    label: "ACME",
    icon: <ApiOutlined />,
    href: "/acme",
  },
  {
    key: "ssh",
    label: "SSH",
    icon: <CodeOutlined />,
    children: [
      {
        key: "/ssh/cas",
        label: "SSH CAs",
        icon: <KeyOutlined />,
        href: "/ssh/cas",
      },
      {
        key: "/ssh/certificates",
        label: "SSH certificates",
        icon: <IdcardOutlined />,
        href: "/ssh/certificates",
      },
      {
        key: "/ssh/principals",
        label: "Principals",
        icon: <TeamOutlined />,
        href: "/ssh/principals",
      },
      MY_SSH,
    ],
  },
  {
    key: "/profiles",
    label: "Profiles",
    icon: <ProfileOutlined />,
    href: "/profiles",
  },
  { key: "/audit", label: "Audit", icon: <AuditOutlined />, href: "/audit" },
].map(withBasePath);

/** What someone signed in with no PKI role may use: their own SSH certificate. */
const NO_ROLE_PAGES: ShellPage[] = [MY_SSH].map(withBasePath);

/** The pages a role may use: principals are for admins. */
const pagesFor = (isAdmin: boolean, isOperator: boolean): ShellPage[] =>
  !isOperator
    ? NO_ROLE_PAGES
    : isAdmin
      ? PAGES
      : PAGES.map((page) => ({
          ...page,
          children: page.children?.filter(
            (child) => child.key !== "/ssh/principals",
          ),
        }));

function withBasePath(page: ShellPage): ShellPage {
  return {
    ...page,
    href: page.href && `${BASE_PATH}${page.href}`,
    children: page.children?.map(withBasePath),
  };
}

/** Which page a route belongs to: a CA is one of the roots' pages, and so on. */
const activePageOf = (pathname: string): string => {
  // A ceremony is held from its CA's page, so it is one of the roots' too.
  if (
    pathname.startsWith("/roots") ||
    pathname.startsWith("/ca") ||
    pathname.startsWith("/ceremony")
  ) {
    return "/roots";
  }
  // A certificate's page is one of the certificates'.
  if (pathname.startsWith("/certificate")) return "/certificates";
  for (const page of [
    "/ssh/cas",
    "/ssh/certificates",
    "/ssh/principals",
    "/ssh/mine",
    "/certificates",
    "/deploy-targets",
    "/acme",
    "/profiles",
    "/audit",
  ]) {
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
  const user = useCurrentUser();
  // Until the user is known, the full sider; with no PKI role, only one's
  // own SSH certificate, and no signer (its status is the roles').
  const operator = !user.data || user.isOperator;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <ControlShell
      nav={nav}
      current={CONSOLE_KEY}
      origin={origin}
      auth={auth}
      pages={pagesFor(user.isAdmin, operator)}
      activePage={activePageOf(pathname)}
      // The router takes the route, without the base path the anchor
      // carries for a new tab.
      onNavigate={(href) => router.push(href.slice(BASE_PATH.length) || "/")}
      actions={
        auth.status === "authenticated" && operator ? <SignerStatusTag /> : null
      }
      signIn={[
        {
          name: "google",
          label: "Sign in with Google",
          icon: <GoogleOutlined />,
        },
      ]}
    >
      {operator && <SealedBanner />}
      <div className={styles.page}>{children}</div>
    </ControlShell>
  );
}
