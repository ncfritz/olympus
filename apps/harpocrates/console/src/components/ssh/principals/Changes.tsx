import { Flex, Tag, Typography } from "antd";
import { timeSince } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/labels";
import { type Change, PRIVILEGED } from "@/lib/sshPrincipals";
import { PrincipalName } from "../../PrincipalName";
import styles from "./SshPrincipals.module.css";

/** The side panel: the mappings' changes, newest first, from the audit log. */
export function Changes({ changes, now }: { changes: Change[]; now: number }) {
  return (
    <Flex vertical>
      <Typography.Title level={5}>Changes</Typography.Title>
      {changes.length === 0 ? (
        <Typography.Text type="secondary">No changes yet.</Typography.Text>
      ) : (
        changes.map((c) => (
          <Flex key={c.key} vertical gap={4} className={styles.change}>
            <Typography.Text strong>{c.identity}</Typography.Text>
            <Flex gap={4} wrap className={styles.chips}>
              {c.added.map((p) => (
                <Tag key={`+${p}`} color={PRIVILEGED.has(p) ? "red" : "green"}>
                  + {p}
                </Tag>
              ))}
              {c.removed.map((p) => (
                <Tag key={`-${p}`}>− {p}</Tag>
              ))}
              {c.added.length + c.removed.length === 0 && (
                <Typography.Text type="secondary" className={styles.small}>
                  No change
                </Typography.Text>
              )}
            </Flex>
            <Typography.Text type="secondary" className={styles.small}>
              <span title={formatDateTime(c.at)}>{timeSince(c.at, now)}</span> ·
              by <PrincipalName principal={c.by} />
            </Typography.Text>
          </Flex>
        ))
      )}
      <Typography.Text type="secondary" className={styles.small}>
        The latest 50, from the audit log.
      </Typography.Text>
    </Flex>
  );
}
