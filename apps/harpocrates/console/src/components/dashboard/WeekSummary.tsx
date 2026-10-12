import { Col, Row, Statistic, Tag, Typography } from "antd";
import type { Dashboard } from "@/lib/api/types";
import styles from "./Dashboard.module.css";

/** What the CA did in the last 7 days. */
export function WeekSummary({
  week,
  revoked,
}: {
  week: Dashboard["week"];
  revoked: number;
}) {
  const note = (text: string) => (
    <Typography.Text type="secondary" className={styles.small}>
      {text}
    </Typography.Text>
  );
  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} md={6}>
        <Statistic title="Issued" value={week.issued} />
        {note(`${week.renewals} renewals`)}
      </Col>
      <Col xs={12} md={6}>
        <Statistic title="Revoked" value={revoked} />
      </Col>
      <Col xs={12} md={6}>
        <Statistic title="ACME orders" value={week.acmeOrders} />
        {week.acmeOrdersFailed > 0 ? (
          <Tag color="red">{week.acmeOrdersFailed} failed</Tag>
        ) : (
          note("none failed")
        )}
      </Col>
      <Col xs={12} md={6}>
        <Statistic title="Deployed" value={week.deployed} />
        {week.deploymentsFailing > 0 ? (
          <Tag color="red">{week.deploymentsFailing} failing</Tag>
        ) : (
          note("none failing")
        )}
      </Col>
    </Row>
  );
}
