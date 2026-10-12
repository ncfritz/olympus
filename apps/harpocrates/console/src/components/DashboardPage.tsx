"use client";

import { BellOutlined, HistoryOutlined } from "@ant-design/icons";
import { SideTabPanel } from "@ncfritz/olympus-console";
import {
  Badge,
  Col,
  Flex,
  Row,
  Skeleton,
  Statistic,
  Tabs,
  Tooltip,
  Typography,
} from "antd";
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
import { CaCard } from "./dashboard/CaCard";
import { CrlTable } from "./dashboard/CrlTable";
import styles from "./dashboard/Dashboard.module.css";
import { EndpointsTable } from "./dashboard/EndpointsTable";
import { ExpiryLanes } from "./dashboard/ExpiryLanes";
import { HealthChart } from "./dashboard/HealthChart";
import { IssuingWindows } from "./dashboard/IssuingWindows";
import { RenewersCard } from "./dashboard/RenewersCard";
import { ActivityTab, AttentionTab } from "./dashboard/SideTabs";
import { WeekSummary } from "./dashboard/WeekSummary";
import { ErrorAlert } from "./ErrorAlert";
import { SignerCard } from "./SignerCard";

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
const PANEL_WIDTH = 380;

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
      <Typography.Text type="secondary" className={styles.small}>
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
    <Typography.Title level={3} className={styles.title}>
      PKI Dashboard
    </Typography.Title>
  );
  if (error) {
    return (
      <Flex vertical gap="large">
        {title}
        <ErrorAlert error={error} title="The dashboard could not be read" />
      </Flex>
    );
  }
  if (!dashboard || !issuers) {
    return (
      <Flex vertical gap="large">
        {title}
        <Skeleton active />
      </Flex>
    );
  }

  const now = Date.parse(dashboard.asOf);
  const { certificates, counts } = dashboard;
  const errors = dashboard.attention.some((a) => a.severity === "error");

  return (
    <Flex vertical gap="large">
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
          title="Expired, last 30 days"
          value={certificates.expiredRecently}
          note={certificates.expiredNames.join(", ") || undefined}
        />
        <Count title="Profiles" value={counts.profiles} />
      </div>
      <div className={styles.graphs}>
        <ActivityChart days={dashboard.activity} />
        <HealthChart health={dashboard.health} />
        <RenewersCard renewers={dashboard.renewers} />
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
        <Tabs
          items={[
            {
              key: "expiring",
              label: "Expiring",
              children: (
                <ExpiryLanes
                  expiring={dashboard.expiring}
                  issuers={issuers}
                  now={now}
                />
              ),
            },
            {
              key: "windows",
              label: "Issuing windows",
              children: <IssuingWindows issuers={issuers} now={now} />,
            },
            {
              key: "lists",
              label: "Revocation lists",
              children: (
                <CrlTable crls={dashboard.crls} issuers={issuers} now={now} />
              ),
            },
            {
              key: "ca",
              label: "The CA",
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <SignerCard />
                  </Col>
                  <Col xs={24} lg={12}>
                    <CaCard ca={dashboard.ca} issuers={issuers} />
                  </Col>
                </Row>
              ),
            },
            {
              key: "week",
              label: "This week",
              children: (
                <WeekSummary
                  week={dashboard.week}
                  revoked={certificates.revokedThisWeek}
                />
              ),
            },
            {
              key: "targets",
              label: "Deploy targets",
              children: <EndpointsTable targets={targets ?? []} />,
            },
          ]}
        />
      </SideTabPanel>
    </Flex>
  );
}
