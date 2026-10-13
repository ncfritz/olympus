import { Flex, Timeline, Typography } from "antd";
import type { AuditEvent, CertificateLineage } from "@/lib/api/types";
import { STORY_KINDS, storyGroupOf } from "@/lib/certificatePage";
import { formatDateTime } from "@/lib/labels";
import { PrincipalName } from "../PrincipalName";
import styles from "./Certificate.module.css";

const COLORS = {
  issuance: "blue",
  deploys: "green",
  revocation: "red",
  keys: "purple",
} as const;

/** How many events the side panel shows: the rest are on the Versions tab. */
const SHOWN = 12;

/** The side panel's activity: its latest events, across its versions. */
export function Activity({
  events,
  lineage,
  onMore,
}: {
  events: AuditEvent[];
  lineage?: CertificateLineage;
  onMore: () => void;
}) {
  const versions = lineage?.versions ?? [];
  const numbers = new Map(
    versions.map((v, i) => [v.certificateId, versions.length - i]),
  );
  if (events.length === 0) {
    return <Typography.Text type="secondary">Nothing yet.</Typography.Text>;
  }
  return (
    <Flex vertical gap="small">
      <Typography.Title level={5} className={styles.boxTitle}>
        Activity
      </Typography.Title>
      <Timeline
        items={events.slice(0, SHOWN).map((e) => {
          const number =
            e.subjectType === "certificate" && e.subjectId
              ? numbers.get(e.subjectId)
              : undefined;
          return {
            key: e.sequence,
            color: COLORS[storyGroupOf(e)],
            content: (
              <Flex vertical>
                <Typography.Text strong>
                  {STORY_KINDS[e.kind] ?? e.kind}
                  {number ? ` (v${number})` : ""}
                  {e.subjectType === "deploy-target" && e.subjectName
                    ? `: ${e.subjectName}`
                    : ""}
                </Typography.Text>
                <Typography.Text type="secondary" className={styles.small}>
                  {formatDateTime(e.occurredAt)} ·{" "}
                  <PrincipalName principal={e.principal} />
                </Typography.Text>
                {e.reason && (
                  <Typography.Text type="secondary" className={styles.small}>
                    {e.reason}
                  </Typography.Text>
                )}
              </Flex>
            ),
          };
        })}
      />
      <Typography.Text className={styles.small}>
        <Typography.Link onClick={onMore}>Its whole story</Typography.Link> is
        on the Versions tab.
      </Typography.Text>
    </Flex>
  );
}
