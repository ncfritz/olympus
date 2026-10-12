"use client";

import { PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Flex,
  Row,
  Skeleton,
  Statistic,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
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
import { formatDateTime } from "@/lib/labels";
import { CaCard } from "./dashboard/CaCard";
import { CrlTable } from "./dashboard/CrlTable";
import { EndpointsTable } from "./dashboard/EndpointsTable";
import { ExpiryLanes } from "./dashboard/ExpiryLanes";
import { IssuingWindows } from "./dashboard/IssuingWindows";
import { SidePanel } from "./dashboard/SidePanel";
import { WeekCard } from "./dashboard/WeekCard";
import { ErrorAlert } from "./ErrorAlert";
import { SignerCard } from "./SignerCard";
import styles from "./dashboard/Dashboard.module.css";

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

/** One headline number, with a line beneath it. */
const Kpi = ({
  title,
  value,
  footer,
  href,
}: {
  title: string;
  value: ReactNode;
  footer: ReactNode;
  href: string;
}) => (
  <Link href={href} className={styles.kpiLink}>
    <Card hoverable className={styles.kpiCard}>
      <Statistic title={title} value={value as string} />
      <div className={styles.kpiFooter}>{footer}</div>
    </Card>
  </Link>
);

const note = (text: string) => (
  <Typography.Text type="secondary" className={styles.small}>
    {text}
  </Typography.Text>
);

/**
 * The CA at a glance (the canvas's "Operations" design): what expires,
 * what needs a person, and whether the CA is healthy.
 */
export function DashboardPage() {
  const { data: dashboard, error } = useDashboard();
  const { data: issuers } = useIssuers();
  const { data: targets } = useDeployTargets();
  const { data: signer } = useSignerStatus();

  const header = (
    <Flex justify="space-between" align="flex-end" gap="middle" wrap>
      <div>
        <Typography.Title level={3} className={styles.title}>
          Dashboard
        </Typography.Title>
        <Typography.Text type="secondary">
          What expires, what needs you, and whether the CA is healthy.
          {dashboard && ` As of ${formatDateTime(dashboard.asOf)}.`}
        </Typography.Text>
      </div>
      <Link href="/certificates/new">
        <Button type="primary" icon={<PlusOutlined />}>
          Issue certificate
        </Button>
      </Link>
    </Flex>
  );

  if (error) {
    return (
      <Flex vertical gap="large">
        {header}
        <ErrorAlert error={error} title="The dashboard could not be read" />
      </Flex>
    );
  }
  if (!dashboard || !issuers) {
    return (
      <Flex vertical gap="large">
        {header}
        <Skeleton active />
      </Flex>
    );
  }

  const now = Date.parse(dashboard.asOf);
  const { certificates, crls } = dashboard;
  const published = crls.filter(
    (crl) =>
      crl.publishedAt && crl.nextUpdate && Date.parse(crl.nextUpdate) > now,
  ).length;
  const waiting = crls.filter(
    (crl) => crl.number !== undefined && !crl.publishedAt,
  ).length;

  return (
    <Flex vertical gap="large">
      {header}
      <div className={styles.kpis}>
        <Kpi
          title="Valid certificates"
          value={certificates.valid}
          href="/certificates"
          footer={note(
            `across ${certificates.issuers} CA${certificates.issuers === 1 ? "" : "s"}`,
          )}
        />
        <Kpi
          title="Due within 30 days"
          value={certificates.dueWithin30Days}
          href="/certificates"
          footer={
            certificates.dueManual > 0 ? (
              <Tag color="orange">
                {certificates.dueManual} need
                {certificates.dueManual === 1 ? "s" : ""} a person
              </Tag>
            ) : (
              note("all renew themselves")
            )
          }
        />
        <Kpi
          title="Expired, last 30 days"
          value={certificates.expiredRecently}
          href="/certificates"
          footer={
            certificates.expiredNames.length > 0 ? (
              <Flex gap={4} wrap>
                {certificates.expiredNames.map((name) => (
                  <Tag key={name} color="red">
                    {name}
                  </Tag>
                ))}
              </Flex>
            ) : (
              note("none unreplaced")
            )
          }
        />
        <Kpi
          title="Revoked"
          value={certificates.revoked}
          href="/certificates"
          footer={note(`${certificates.revokedThisWeek} this week`)}
        />
        <Kpi
          title="Revocation lists"
          value={`${published} / ${crls.length}`}
          href="/roots"
          footer={
            waiting > 0 ? (
              <Tag color="gold">{waiting} waiting</Tag>
            ) : published === crls.length ? (
              <Tag color="green">all published</Tag>
            ) : (
              <Tag color="red">{crls.length - published} lapsed or none</Tag>
            )
          }
        />
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <ExpiryLanes
            expiring={dashboard.expiring}
            issuers={issuers}
            now={now}
          />
        </Col>
        <Col xs={24} xl={8}>
          <SidePanel
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
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12} xl={7}>
          <IssuingWindows issuers={issuers} now={now} />
        </Col>
        <Col xs={24} lg={12} xl={9}>
          <CrlTable crls={crls} issuers={issuers} now={now} />
        </Col>
        <Col xs={24} xl={8}>
          <Flex vertical gap="middle">
            <SignerCard />
            <CaCard ca={dashboard.ca} issuers={issuers} />
          </Flex>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <WeekCard
            week={dashboard.week}
            revoked={certificates.revokedThisWeek}
          />
        </Col>
        <Col xs={24} xl={14}>
          <EndpointsTable targets={targets ?? []} />
        </Col>
      </Row>
    </Flex>
  );
}
