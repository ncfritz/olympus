"use client";

import {
  BarChartOutlined,
  SafetyOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";
import { Alert, Button, Flex, Skeleton, Tabs, Tooltip, Typography } from "antd";
import { type ReactNode, useMemo, useState } from "react";
import { mutate } from "swr";
import {
  KEYS,
  useAuditActivity,
  useAuditVerification,
} from "@/lib/api/queries";
import type { AuditGroup } from "@/lib/api/types";
import { countsOf } from "@/lib/audit";
import { principalName } from "@/lib/principals";
import { usePrincipals } from "@/lib/api/queries";
import { Count, CountStrip } from "../CountStrip";
import { ErrorAlert } from "../ErrorAlert";
import { ActivityGraphs } from "./ActivityGraphs";
import { ActivityLanes } from "./ActivityLanes";
import styles from "./Audit.module.css";
import { AuditList } from "./AuditList";

const DAY = 24 * 60 * 60 * 1000;

/** The days the graphs and counts cover; the lanes go back further. */
const DAYS = 30;
const LANE_DAYS = 90;

const TabIcon = ({ title, icon }: { title: string; icon: ReactNode }) => (
  <Tooltip title={title} placement="left">
    <span aria-label={title}>{icon}</span>
  </Tooltip>
);

/**
 * The audit log (ADR 0020, Audit): its counts and whether its chain holds;
 * beneath, the activity as graphs or as lanes, in tabs on the right that
 * span the page; and beneath them the log itself.
 */
export function AuditPage() {
  const { data: activity, error } = useAuditActivity(LANE_DAYS);
  const {
    data: verification,
    error: verifyError,
    isValidating: verifying,
  } = useAuditVerification();
  const { data: emails } = usePrincipals();
  const [groups, setGroups] = useState<AuditGroup[]>([]);

  const now = activity ? Date.parse(activity.asOf) : 0;
  const since = now - DAYS * DAY;
  const recent = useMemo(
    () =>
      (activity?.points ?? []).filter((p) => Date.parse(p.occurredAt) >= since),
    [activity, since],
  );
  const counts = countsOf(recent, since);
  const groupCounts = useMemo(() => {
    const map = new Map<AuditGroup, number>();
    for (const p of recent) map.set(p.group, (map.get(p.group) ?? 0) + 1);
    return map;
  }, [recent]);

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
          Audit log
        </Typography.Title>
        <Typography.Text type="secondary">
          Who did what, each event covering the one before: a change, a gap or
          an event put in after shows when the chain is verified.
        </Typography.Text>
      </div>
      <Button
        icon={<SafetyOutlined />}
        loading={verifying}
        onClick={() => mutate(KEYS.auditVerification)}
      >
        Verify the chain
      </Button>
    </Flex>
  );

  if (error || !activity) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.padded}>
          <ErrorAlert error={error} title="The audit log could not be read" />
          {!error && <Skeleton active />}
        </div>
      </div>
    );
  }

  const people = counts.byPerson
    .slice(0, 2)
    .map(([principal, n]) => `${principalName(principal, emails)} ${n}`)
    .join(" · ");

  return (
    <div className={styles.page}>
      {header}
      <CountStrip>
        <Count
          title="Events, 30 days"
          value={counts.events}
          note={`${Math.round(counts.events / DAYS)} a day`}
        />
        <Count
          title="By people"
          value={counts.people}
          note={people || "None"}
        />
        <Count
          title="Automatic"
          value={counts.automatic}
          note="Renewal, ACME, lists, OCSP"
        />
        <Count
          title="Sensitive"
          value={counts.sensitive}
          note="Keys, ceremonies, seal, revocations"
        />
        <Count title="Refused" value={counts.refused} note="Requests refused" />
        <Count
          title="Chain"
          value={verification?.events ?? 0}
          note={
            verification ? (
              <Typography.Text
                type={verification.valid ? "success" : "danger"}
                className={styles.small}
              >
                {verification.valid
                  ? "events verified: intact"
                  : `broken at #${verification.brokenAt}`}
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary" className={styles.small}>
                {verifyError ? "could not be verified" : "verifying…"}
              </Typography.Text>
            )
          }
        />
      </CountStrip>
      {verification && !verification.valid && (
        <Alert
          type="error"
          showIcon
          banner
          title={`The chain is broken at #${verification.brokenAt}: that event, or one before it, was changed, removed or put in after.`}
        />
      )}
      <Tabs
        tabPlacement="end"
        className={styles.sideTabs}
        items={[
          {
            key: "activity",
            label: <TabIcon title="Activity" icon={<BarChartOutlined />} />,
            children: <ActivityGraphs points={recent} now={now} days={DAYS} />,
          },
          {
            key: "lanes",
            label: (
              <TabIcon title="By kind, over time" icon={<ScheduleOutlined />} />
            ),
            children: (
              <ActivityLanes
                points={activity.points}
                now={now}
                selected={groups}
                onSelect={(group) =>
                  setGroups(
                    groups.includes(group)
                      ? groups.filter((g) => g !== group)
                      : [...groups, group],
                  )
                }
              />
            ),
          },
        ]}
      />
      <AuditList
        groups={groups}
        onGroups={setGroups}
        counts={groupCounts}
        now={now}
      />
    </div>
  );
}
