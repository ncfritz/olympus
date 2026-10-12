import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  MinusCircleFilled,
} from "@ant-design/icons";
import { Button, Flex, Tag, Timeline, Typography } from "antd";
import Link from "next/link";
import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { AuditVerification, Dashboard } from "@/lib/api/types";
import {
  describeActor,
  describeEvent,
  eventColor,
  handledRows,
  type HealthCheck,
  type HealthStatus,
} from "@/lib/dashboard";
import { formatDateTime } from "@/lib/labels";
import { ErrorAlert } from "../ErrorAlert";
import { AttentionList } from "./AttentionList";
import styles from "./Dashboard.module.css";

/** A health line's mark: an icon and its colour, never colour alone. */
const STATUS_ICON: Record<HealthStatus, React.ReactNode> = {
  ok: (
    <Typography.Text type="success" aria-label="Fine">
      <CheckCircleFilled />
    </Typography.Text>
  ),
  warning: (
    <Typography.Text type="warning" aria-label="Needs doing">
      <ExclamationCircleFilled />
    </Typography.Text>
  ),
  error: (
    <Typography.Text type="danger" aria-label="Broken">
      <CloseCircleFilled />
    </Typography.Text>
  ),
  neutral: (
    <Typography.Text type="secondary" aria-label="Not judged">
      <MinusCircleFilled />
    </Typography.Text>
  ),
};

const Section = ({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Flex vertical gap="small">
    <Flex justify="space-between" align="center" gap="small">
      <Typography.Title level={5} className={styles.section}>
        {title}
      </Typography.Title>
      {extra}
    </Flex>
    {children}
  </Flex>
);

/** The audit chain, verified on request: it walks every event. */
function AuditVerify() {
  const [verification, setVerification] = useState<AuditVerification>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const verify = async () => {
    setBusy(true);
    try {
      setVerification(
        unwrap(await apiClient.GET("/v1/audit/verification")).verification,
      );
      setError(undefined);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Flex vertical gap={4} align="flex-start">
      {verification ? (
        verification.valid ? (
          <Tag color="green">
            Verified, {verification.events.toLocaleString()} events
          </Tag>
        ) : (
          <Tag color="red">Broken at {verification.brokenAt}</Tag>
        )
      ) : (
        <Button size="small" onClick={verify} loading={busy}>
          Verify
        </Button>
      )}
      <ErrorAlert error={error} />
    </Flex>
  );
}

/** The CA's health, line by line, then what needs a person. */
export function AttentionTab({
  dashboard,
  health,
  now,
}: {
  dashboard: Dashboard;
  health: HealthCheck[];
  now: number;
}) {
  const fine = health.filter((check) => check.status === "ok").length;
  const judged = health.filter((check) => check.status !== "neutral").length;
  return (
    <Flex vertical gap="large">
      <Section
        title="Health"
        extra={
          <Tag color={fine === judged ? "green" : "orange"}>
            {fine} of {judged} fine
          </Tag>
        }
      >
        <Flex vertical>
          {health.map((check) => (
            <Flex
              key={check.name}
              gap="small"
              align="flex-start"
              className={styles.check}
            >
              {STATUS_ICON[check.status]}
              <Flex vertical className={styles.shrink}>
                <Typography.Text strong>{check.name}</Typography.Text>
                <Typography.Text type="secondary" className={styles.small}>
                  {check.detail}
                </Typography.Text>
                {check.name === "Audit chain" && <AuditVerify />}
              </Flex>
            </Flex>
          ))}
        </Flex>
      </Section>
      <Section title="Needs a person">
        <AttentionList items={dashboard.attention} now={now} />
      </Section>
    </Flex>
  );
}

/** The latest audit events, then what was handled without a person. */
export function ActivityTab({ dashboard }: { dashboard: Dashboard }) {
  const handled = handledRows(dashboard.handled);
  return (
    <Flex vertical gap="large">
      <Section title="Recent activity" extra={<Link href="/audit">Audit</Link>}>
        <Timeline
          className={styles.timeline}
          items={dashboard.recent.map((event) => ({
            key: event.sequence,
            color: eventColor(event),
            content: (
              <Flex vertical className={styles.shrink}>
                <Typography.Text>{describeEvent(event)}</Typography.Text>
                <Typography.Text type="secondary" className={styles.small}>
                  {describeActor(event)} · {formatDateTime(event.occurredAt)}
                </Typography.Text>
              </Flex>
            ),
          }))}
        />
      </Section>
      <Section title="Handled without you, this week">
        {handled.length === 0 ? (
          <Typography.Text type="secondary">
            Nothing yet this week.
          </Typography.Text>
        ) : (
          <Flex vertical gap="small">
            {handled.map((row) => (
              <Flex key={row.label} justify="space-between" gap="small">
                <Typography.Text>{row.label}</Typography.Text>
                <Typography.Text strong>{row.count}</Typography.Text>
              </Flex>
            ))}
          </Flex>
        )}
        <Link href="/audit">See them in the audit log</Link>
      </Section>
    </Flex>
  );
}
