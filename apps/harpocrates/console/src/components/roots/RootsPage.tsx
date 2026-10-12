"use client";

import { ImportOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Flex, Skeleton, Tabs, Typography } from "antd";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useCurrentUser, useDashboard, useIssuers } from "@/lib/api/queries";
import { SHAPES } from "@/lib/labels";
import {
  backupUnproved,
  closingSoon,
  groupsOf,
  shownIssuers,
} from "@/lib/roots";
import { shortCaName } from "@/lib/tree";
import { Count, CountStrip } from "../CountStrip";
import { ErrorAlert } from "../ErrorAlert";
import { CaBoard } from "./CaBoard";
import { CaDiagram } from "./CaDiagram";
import { CaList } from "./CaList";
import { CaTimeline } from "./CaTimeline";
import styles from "./Roots.module.css";

/** The tabs, each one of the canvas's four roots designs, by `?view=`. */
const VIEWS = ["list", "graph", "board", "timeline"] as const;
type View = (typeof VIEWS)[number];

/**
 * The CAs (ADR 0032): each root a trust anchor of its own and the CAs
 * beneath it, and the CAs imported without theirs. Their counts across
 * the top; beneath, the same CAs as a list, a graph, a board of columns
 * and a timeline.
 */
export function RootsPage() {
  const { data: all, error, isLoading } = useIssuers();
  const { data: dashboard, error: dashboardError } = useDashboard();
  const { isAdmin } = useCurrentUser();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view: View = VIEWS.find((v) => v === params.get("view")) ?? "list";

  const issuers = useMemo(() => shownIssuers(all ?? []), [all]);
  const authorities = useMemo(
    () => new Map((dashboard?.authorities ?? []).map((a) => [a.issuerId, a])),
    [dashboard],
  );
  const now = dashboard ? Date.parse(dashboard.asOf) : 0;
  const { roots, outside } = groupsOf(issuers);

  const header = (
    <Flex
      justify="space-between"
      align="center"
      wrap
      gap="middle"
      className={styles.header}
    >
      <div>
        <Typography.Title level={3} className={styles.title}>
          Certificate authorities
        </Typography.Title>
        <Typography.Text type="secondary">
          Each root anchors only what is beneath it: trusting one says nothing
          of another.
        </Typography.Text>
      </div>
      <Flex gap="small">
        <Link href="/roots/import">
          <Button icon={<ImportOutlined />} disabled={!isAdmin}>
            Import
          </Button>
        </Link>
        <Link href="/roots/new">
          <Button type="primary" icon={<PlusOutlined />} disabled={!isAdmin}>
            New root
          </Button>
        </Link>
      </Flex>
    </Flex>
  );

  if (error || dashboardError || isLoading || !dashboard) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.padded}>
          <ErrorAlert
            error={error ?? dashboardError}
            title="The CAs could not be listed"
          />
          {!error && !dashboardError && <Skeleton active />}
        </div>
      </div>
    );
  }

  const tier = (t: string) => issuers.filter((issuer) => issuer.tier === t);
  const live = (list: typeof issuers) =>
    list.filter((issuer) => issuer.status === "active");
  const shapes = [
    ...new Set(roots.flatMap((r) => (r.shape ? [SHAPES[r.shape].label] : []))),
  ];
  const unproved = issuers.filter(backupUnproved);
  const closing = issuers.filter((issuer) => closingSoon(issuer, now));
  const totals = [...authorities.values()].reduce(
    (sum, a) => ({
      valid: sum.valid + a.valid,
      expired: sum.expired + a.expired,
      revoked: sum.revoked + a.revoked,
    }),
    { valid: 0, expired: 0, revoked: 0 },
  );
  const names = (list: typeof issuers) =>
    list.map((issuer) => shortCaName(issuer)).join(", ") || undefined;
  const issuing = tier("issuing");

  const tabs = [
    {
      key: "list",
      label: "List",
      children: (
        <CaList
          issuers={issuers}
          authorities={authorities}
          now={now}
          isAdmin={isAdmin}
        />
      ),
    },
    {
      key: "graph",
      label: "Graph",
      children: (
        <CaDiagram
          issuers={issuers}
          authorities={authorities}
          now={now}
          isAdmin={isAdmin}
        />
      ),
    },
    {
      key: "board",
      label: "Board",
      children: (
        <CaBoard
          issuers={issuers}
          authorities={authorities}
          certificates={dashboard.certificateList}
          now={now}
          isAdmin={isAdmin}
        />
      ),
    },
    {
      key: "timeline",
      label: "Timeline",
      children: (
        <CaTimeline
          issuers={issuers}
          authorities={authorities}
          attention={dashboard.attention}
          now={now}
        />
      ),
    },
  ];

  return (
    <div className={styles.page}>
      {header}
      <CountStrip>
        <Count
          title="Roots"
          value={roots.length}
          note={shapes.join(" · ") || undefined}
        />
        <Count
          title="Intermediates"
          value={tier("intermediate").length}
          note={`${live(tier("intermediate")).length} active, offline`}
        />
        <Count
          title="Issuing CAs"
          value={issuing.length}
          note={`${live(issuing).length} active${outside.length ? ` · ${outside.length} imported` : ""}`}
        />
        <Count
          title="Valid certificates"
          value={totals.valid}
          note={`${totals.expired} expired · ${totals.revoked} revoked`}
        />
        <Count
          title="Backups to prove"
          value={unproved.length}
          note={names(unproved)}
        />
        <Count
          title="Closing within a year"
          value={closing.length}
          note={names(closing)}
        />
      </CountStrip>
      {issuers.length === 0 ? (
        <Empty
          className={styles.padded}
          description="No CAs yet. Harpocrates starts empty in production: create the first root."
        />
      ) : (
        <Tabs
          className={styles.tabs}
          activeKey={view}
          onChange={(key) => router.replace(`${pathname}?view=${key}`)}
          items={tabs}
        />
      )}
    </div>
  );
}
