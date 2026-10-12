"use client";

import { BellOutlined, HistoryOutlined } from "@ant-design/icons";
import { SideTabPanel } from "@ncfritz/olympus-console";
import { Badge, Skeleton, Statistic, Tabs, Tooltip, Typography } from "antd";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import {
  useCurrentUser,
  useDashboard,
  useDeployTargets,
  useIssuers,
  useSignerStatus,
} from "@/lib/api/queries";
import { healthChecks } from "@/lib/dashboard";
import { ActivityChart } from "./dashboard/ActivityChart";
import { AuthoritiesTable, CaLifetimes } from "./dashboard/Authorities";
import { CertificateList } from "./dashboard/CertificateList";
import styles from "./dashboard/Dashboard.module.css";
import { ExpiryCharts } from "./dashboard/ExpiryCharts";
import { HealthChart } from "./dashboard/HealthChart";
import { RenewersCard } from "./dashboard/RenewersCard";
import { ActivityTab, AttentionTab } from "./dashboard/SideTabs";
import { TimelineView } from "./dashboard/TimelineView";
import { ErrorAlert } from "./ErrorAlert";

/**
 * The console's home: the dashboard for the PKI roles; someone with none
 * has only their own SSH certificate here, and goes there.
 */
export function HomePage() {
  const router = useRouter();
  const { data: user, isOperator } = useCurrentUser();
  const noRole = Boolean(user) && !isOperator;
  useEffect(() => {
    if (noRole) router.replace("/ssh/mine");
  }, [noRole, router]);
  return user && isOperator ? <DashboardPage /> : null;
}

/** The side panel's width, open. */
const PANEL_WIDTH = 480;

const TabIcon = ({ title, icon }: { title: string; icon: ReactNode }) => (
  <Tooltip title={title} placement="left">
    <span aria-label={title}>{icon}</span>
  </Tooltip>
);

/** One headline count, as the main site's Goals summary strip has them. */
const Count = ({
  title,
  value,
  note,
}: {
  title: string;
  value: number;
  note?: string;
}) => (
  <div className={styles.cell}>
    <Statistic title={title} value={value} />
    {note && (
      <Typography.Text
        type="secondary"
        className={styles.small}
        ellipsis={{ tooltip: note }}
      >
        {note}
      </Typography.Text>
    )}
  </div>
);

/**
 * The CA at a glance: the counts, three graphs (activity, certificates by
 * renewal health, who renews them), the rest in tabs beneath, and beside
 * those a collapsible panel of what needs attention and what happened.
 */
export function DashboardPage() {
  const { data: dashboard, error } = useDashboard();
  const { data: issuers } = useIssuers();
  const { data: targets } = useDeployTargets();
  const { data: signer } = useSignerStatus();

  const title = (
    <div className={styles.header}>
      <Typography.Title level={3} className={styles.title}>
        PKI Dashboard
      </Typography.Title>
    </div>
  );
  if (error) {
    return (
      <div className={styles.page}>
        {title}
        <div className={styles.header}>
          <ErrorAlert error={error} title="The dashboard could not be read" />
        </div>
      </div>
    );
  }
  if (!dashboard || !issuers) {
    return (
      <div className={styles.page}>
        {title}
        <div className={styles.header}>
          <Skeleton active />
        </div>
      </div>
    );
  }

  const now = Date.parse(dashboard.asOf);
  const { certificates, counts } = dashboard;
  const errors = dashboard.attention.some((a) => a.severity === "error");

  return (
    <div className={`${styles.page} ${styles.fill}`}>
      {title}
      <div className={styles.strip}>
        <Count
          title="CAs"
          value={counts.cas}
          note={`${counts.offlineCas} offline · ${counts.cas - counts.offlineCas} online`}
        />
        <Count
          title="Valid certificates"
          value={certificates.valid}
          note={`${certificates.dueWithin30Days} due within 30 days`}
        />
        <Count
          title="SSH certificates"
          value={counts.sshValid}
          note={`${counts.sshUser} user · ${counts.sshHost} host`}
        />
        <Count
          title="Revoked"
          value={certificates.revoked}
          note={`${certificates.revokedThisWeek} this week`}
        />
        <Count
          title="Expired, last 30"
          value={certificates.expiredRecently}
          note={certificates.expiredNames.join(", ") || undefined}
        />
        <Count title="Profiles" value={counts.profiles} />
      </div>
      <SideTabPanel
        panelId="harpocrates.dashboard"
        width={PANEL_WIDTH}
        defaultExpanded
        className={styles.lower}
        tabs={[
          {
            key: "attention",
            label: (
              <TabIcon
                title="Needs attention"
                icon={
                  <Badge
                    count={dashboard.attention.length}
                    size="small"
                    color={errors ? "red" : "orange"}
                  >
                    <BellOutlined />
                  </Badge>
                }
              />
            ),
            children: (
              <AttentionTab
                dashboard={dashboard}
                now={now}
                health={healthChecks({
                  dashboard,
                  signer,
                  issuers,
                  targets: targets ?? [],
                  now,
                })}
              />
            ),
          },
          {
            key: "activity",
            label: <TabIcon title="Activity" icon={<HistoryOutlined />} />,
            children: <ActivityTab dashboard={dashboard} />,
          },
        ]}
      >
        <div className={styles.graphs}>
          <ActivityChart days={dashboard.activity} />
          <HealthChart health={dashboard.health} />
          <RenewersCard renewers={dashboard.renewers} />
        </div>
        <Tabs
          className={styles.mainTabs}
          items={[
            {
              key: "certificates",
              label: "Certificates",
              children: (
                <CertificateList
                  certificates={dashboard.certificateList}
                  issuers={issuers}
                  now={now}
                  order="health"
                />
              ),
            },
            {
              key: "authorities",
              label: "Authorities",
              children: (
                <>
                  <CaLifetimes issuers={issuers} now={now} />
                  <AuthoritiesTable
                    authorities={dashboard.authorities}
                    issuers={issuers}
                    now={now}
                  />
                </>
              ),
            },
            {
              key: "expirations",
              label: "Expirations",
              children: (
                <>
                  <ExpiryCharts
                    certificates={dashboard.certificateList}
                    issuers={issuers}
                    now={now}
                  />
                  <CertificateList
                    certificates={dashboard.certificateList}
                    issuers={issuers}
                    now={now}
                    order="expiry"
                  />
                </>
              ),
            },
            {
              key: "timeline",
              label: "Timeline",
              children: (
                <TimelineView
                  certificates={dashboard.certificateList}
                  authorities={dashboard.authorities}
                  issuers={issuers}
                  now={now}
                />
              ),
            },
          ]}
        />
      </SideTabPanel>
    </div>
  );
}
