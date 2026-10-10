"use client";

import { Button, Card, Col, Flex, Row, Statistic, Typography } from "antd";
import Link from "next/link";
import { useCertificates, useIssuers } from "@/lib/api/queries";
import { ErrorAlert } from "./ErrorAlert";
import { SignerCard } from "./SignerCard";

/** Renewal looks this far ahead (ADR 0020: internal-tls renews at 60 days of 90). */
const EXPIRING_DAYS = 30;

/** The CA at a glance: the signer, the hierarchy, what is about to expire. */
export function DashboardPage() {
  const { data: issuers, error } = useIssuers();
  const { data: valid } = useCertificates({ state: "valid", pageSize: 1 });
  const { data: expiring } = useCertificates({
    state: "valid",
    expiringWithinDays: EXPIRING_DAYS,
    pageSize: 1,
  });
  const live = (issuers ?? []).filter((issuer) => !issuer.discardedAt);
  const count = (tier: string) =>
    live.filter((issuer) => issuer.tier === tier).length;
  const unproved = live.filter(
    (issuer) => issuer.offline && !issuer.provedAt,
  ).length;

  return (
    <Flex vertical gap="large">
      <Typography.Title level={3}>Harpocrates</Typography.Title>
      <ErrorAlert error={error} title="The CAs could not be listed" />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <SignerCard />
        </Col>
        <Col xs={24} lg={14}>
          <Card
            title="Hierarchy"
            extra={
              <Link href="/roots">
                <Button type="link">Roots</Button>
              </Link>
            }
          >
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="Roots" value={count("root")} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Intermediates"
                  value={count("intermediate")}
                />
              </Col>
              <Col span={6}>
                <Statistic title="Issuing CAs" value={count("issuing")} />
              </Col>
              <Col span={6}>
                <Statistic title="Backups not proved" value={unproved} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card
            title="Certificates"
            extra={
              <Link href="/certificates">
                <Button type="link">All</Button>
              </Link>
            }
          >
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="Valid" value={valid?.count ?? "—"} />
              </Col>
              <Col span={12}>
                <Statistic
                  title={`Expiring within ${EXPIRING_DAYS} days`}
                  value={expiring?.count ?? "—"}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
