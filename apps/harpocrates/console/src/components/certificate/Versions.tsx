import { Flex, Segmented, Tag, Timeline, Typography } from "antd";
import Link from "next/link";
import { type CSSProperties, useState } from "react";
import type {
  AuditEvent,
  CertificateLineage,
  FullCertificate,
} from "@/lib/api/types";
import {
  nextStepsOf,
  RENEWED_BY,
  renewalLeads,
  STORY_KINDS,
  type StoryGroup,
  storyGroupOf,
} from "@/lib/certificatePage";

import { formatDate, formatDateTime } from "@/lib/labels";
import { PrincipalName } from "../PrincipalName";
import { CATEGORICAL } from "../dashboard/chartColors";
import { useChartTheme } from "../dashboard/chartTheme";
import styles from "./Certificate.module.css";

const STORY_FILTERS: [StoryGroup | "all", string][] = [
  ["all", "All"],
  ["issuance", "Issuance"],
  ["deploys", "Deploys"],
  ["revocation", "Revocation"],
  ["keys", "Its key"],
];

const STORY_COLORS: Record<StoryGroup, string> = {
  issuance: "blue",
  deploys: "green",
  revocation: "red",
  keys: "purple",
};

/** A renewal's bar: its height and colour, the only values set from code. */
const leadStyle = (share: number, color: string) =>
  ({
    "--height": `${Math.max(2, Math.round(Math.max(0, share) * 36))}px`,
    "--color": color,
  }) as CSSProperties;

/** A version's state, as its card's tag. */
const versionTag = (
  v: CertificateLineage["versions"][number],
  newest: boolean,
  now: number,
) =>
  v.state === "revoked" ? (
    <Tag color="red">Revoked</Tag>
  ) : Date.parse(v.notAfter) <= now ? (
    <Tag>Expired</Tag>
  ) : newest ? (
    <Tag color="green">Current</Tag>
  ) : (
    <Tag color="gold">Replaced, still valid</Tag>
  );

/**
 * The Versions tab: each version as a card, newest first (this one
 * marked), its story from the audit log (its versions' and its deploy
 * targets'), and what happens next to the current version.
 */
export function Versions({
  certificate,
  lineage,
  events,
  now,
}: {
  certificate: FullCertificate;
  lineage?: CertificateLineage;
  events: AuditEvent[];
  now: number;
}) {
  const { mode } = useChartTheme();
  const [group, setGroup] = useState<StoryGroup | "all">("all");
  const versions = lineage?.versions ?? [];
  const numbers = new Map(
    versions.map((v, i) => [v.certificateId, versions.length - i]),
  );
  const isCurrent = versions[0]?.certificateId === certificate.id;
  const steps = nextStepsOf(certificate, lineage, isCurrent, now);
  const leads = renewalLeads(lineage);
  const most = Math.max(1, ...leads.map((l) => l.days));
  const shown = events.filter(
    (e) => group === "all" || storyGroupOf(e) === group,
  );

  return (
    <>
      <div className={styles.section}>
        <Typography.Title level={5} className={styles.boxTitle}>
          Versions, newest first
        </Typography.Title>
        {lineage && (
          <Typography.Text type="secondary" className={styles.small}>
            Renewed by {RENEWED_BY[lineage.renewer]} · each the same name, from
            the same profile
          </Typography.Text>
        )}
      </div>
      <div className={styles.versions}>
        {versions.length === 0 ? (
          <Typography.Text type="secondary">
            Its versions could not be read.
          </Typography.Text>
        ) : (
          versions.map((v, i) => (
            <Flex key={v.certificateId} gap={4} align="stretch">
              {i > 0 && (
                <div className={styles.arrow} aria-hidden>
                  ←
                </div>
              )}
              <Link
                href={`/certificate?id=${v.certificateId}&view=versions`}
                className={`${styles.version} ${v.certificateId === certificate.id ? styles.versionOn : ""}`}
                aria-current={
                  v.certificateId === certificate.id ? "page" : undefined
                }
              >
                <Flex justify="space-between" align="center" gap="small">
                  <Typography.Text strong>
                    v{versions.length - i}
                  </Typography.Text>
                  {versionTag(v, i === 0, now)}
                </Flex>
                <Typography.Text className={styles.small}>
                  {formatDate(v.notBefore)} → {formatDate(v.notAfter)}
                </Typography.Text>
                <Typography.Text
                  type="secondary"
                  className={`${styles.small} ${styles.mono}`}
                >
                  serial {v.serial.slice(0, 12)}…
                </Typography.Text>
                <Typography.Text type="secondary" className={styles.small}>
                  {v.renews ? "renews the one before" : "new: the first"}
                </Typography.Text>
              </Link>
            </Flex>
          ))
        )}
      </div>
      <div className={styles.split}>
        <section className={styles.box}>
          <Flex justify="space-between" align="center" gap="small" wrap>
            <Typography.Title level={5} className={styles.boxTitle}>
              Its story
            </Typography.Title>
            <Segmented<StoryGroup | "all">
              size="small"
              value={group}
              onChange={setGroup}
              options={STORY_FILTERS.map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Flex>
          {shown.length === 0 ? (
            <Typography.Text type="secondary">Nothing yet.</Typography.Text>
          ) : (
            <Timeline
              className={styles.story}
              items={shown.map((e) => {
                const number =
                  e.subjectType === "certificate" && e.subjectId
                    ? numbers.get(e.subjectId)
                    : undefined;
                return {
                  key: e.sequence,
                  color: STORY_COLORS[storyGroupOf(e)],
                  content: (
                    <Flex vertical>
                      <Typography.Text>
                        <span className={styles.when}>
                          {formatDateTime(e.occurredAt)}
                        </span>
                        <Typography.Text strong>
                          {STORY_KINDS[e.kind] ?? e.kind}
                          {number ? ` (v${number})` : ""}
                          {e.subjectType === "deploy-target" && e.subjectName
                            ? `: ${e.subjectName}`
                            : ""}
                        </Typography.Text>
                      </Typography.Text>
                      <Typography.Text
                        type="secondary"
                        className={styles.small}
                      >
                        By <PrincipalName principal={e.principal} />
                        {e.reason ? ` · ${e.reason}` : ""}
                      </Typography.Text>
                    </Flex>
                  ),
                };
              })}
            />
          )}
          <Typography.Text type="secondary" className={styles.small}>
            <Link href="/audit">The audit log</Link> has every event.
          </Typography.Text>
        </section>
        <section className={styles.box}>
          <Typography.Title level={5} className={styles.boxTitle}>
            What happens next
          </Typography.Title>
          {steps.length === 0 ? (
            <Typography.Text type="secondary">
              {isCurrent
                ? "Nothing: it is no longer in use."
                : "Nothing to this version: a newer one replaced it."}
            </Typography.Text>
          ) : (
            <Flex vertical gap={10}>
              {steps.map((step) => (
                <Flex key={step.key} gap="small" align="flex-start">
                  <Tag color={step.color}>
                    {step.at <= now
                      ? "Now"
                      : formatDate(new Date(step.at).toISOString())}
                  </Tag>
                  <Typography.Text>{step.text}</Typography.Text>
                </Flex>
              ))}
            </Flex>
          )}
          {leads.length > 0 && (
            <>
              <Typography.Text className={styles.label}>
                How early each renewal came
              </Typography.Text>
              <div
                className={styles.leads}
                role="img"
                aria-label={leads
                  .map((l) => `v${l.version}: ${l.days} days early`)
                  .join(", ")}
              >
                {leads.map((l) => (
                  <Flex key={l.version} vertical align="center" gap={2}>
                    <span
                      className={styles.lead}
                      style={leadStyle(l.days / most, CATEGORICAL[mode][2])}
                    />
                    <Typography.Text type="secondary" className={styles.small}>
                      v{l.version}
                    </Typography.Text>
                  </Flex>
                ))}
              </div>
              <Typography.Text type="secondary" className={styles.small}>
                {leads.map((l) => `${l.days} d`).join(", ")} before the version
                it replaced ended
              </Typography.Text>
            </>
          )}
        </section>
      </div>
    </>
  );
}
