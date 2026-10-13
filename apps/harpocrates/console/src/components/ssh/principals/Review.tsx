import { Button, Checkbox, Flex, Table, Tag, Typography } from "antd";
import { useState } from "react";
import {
  type PersonRow,
  REASONS,
  type ReviewItem,
  USAGE_DAYS,
} from "@/lib/sshPrincipals";
import { PrincipalTag } from "./MappingList";
import styles from "./SshPrincipals.module.css";

/**
 * The To Review tab: the grants worth a look (privileged, unused, people
 * never signed), each kept or removed, several removed at once. Keeping
 * one sets it aside until the page is next opened.
 */
export function Review({
  items,
  rows,
  busy,
  onRemove,
}: {
  items: ReviewItem[];
  rows: PersonRow[];
  busy: boolean;
  /** Removes these grants: a principal, or a whole mapping. */
  onRemove: (items: ReviewItem[]) => void;
}) {
  const [kept, setKept] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const shown = items.filter((i) => !kept.includes(i.key));
  const chosen = shown.filter((i) => selected.includes(i.key));
  const row = (identity: string) => rows.find((r) => r.identity === identity);

  return (
    <>
      <Flex gap="middle" align="center" wrap className={styles.bar}>
        <Button
          type="primary"
          danger
          disabled={chosen.length === 0}
          loading={busy}
          onClick={() => {
            onRemove(chosen);
            setSelected([]);
          }}
        >
          Remove selected ({chosen.length})
        </Button>
        <Typography.Text type="secondary" className={styles.small}>
          Removing changes certificates signed from now; revoke their current
          ones to end access at once.
          {kept.length > 0 && ` ${kept.length} kept for now.`}
        </Typography.Text>
      </Flex>
      <Table<ReviewItem>
        rowKey="key"
        size="middle"
        pagination={false}
        dataSource={shown}
        className={styles.flushTable}
        tableLayout="fixed"
        scroll={{ x: 760 }}
        locale={{
          emptyText: `Nothing to look at: no privileged grants, and every grant carried in ${USAGE_DAYS} days`,
        }}
        columns={[
          {
            key: "select",
            width: 48,
            title: (
              <Checkbox
                aria-label="Select all"
                checked={shown.length > 0 && chosen.length === shown.length}
                indeterminate={
                  chosen.length > 0 && chosen.length < shown.length
                }
                onChange={(e) =>
                  setSelected(e.target.checked ? shown.map((i) => i.key) : [])
                }
              />
            ),
            render: (_, i) => (
              <Checkbox
                aria-label={`Select ${i.identity}`}
                checked={selected.includes(i.key)}
                onChange={(e) =>
                  setSelected((keys) =>
                    e.target.checked
                      ? [...keys, i.key]
                      : keys.filter((k) => k !== i.key),
                  )
                }
              />
            ),
          },
          {
            title: "Person",
            key: "person",
            width: 240,
            render: (_, i) => (
              <Flex vertical className={styles.shrink}>
                <Typography.Text strong ellipsis={{ tooltip: i.identity }}>
                  {i.identity}
                </Typography.Text>
                <Flex gap={4} wrap align="center" className={styles.chips}>
                  <Typography.Text type="secondary" className={styles.small}>
                    as
                  </Typography.Text>
                  {(i.principal
                    ? [i.principal]
                    : (row(i.identity)?.principals ?? [])
                  ).map((p) => (
                    <PrincipalTag
                      key={p}
                      principal={p}
                      used={row(i.identity)?.used.has(p) ?? false}
                    />
                  ))}
                </Flex>
              </Flex>
            ),
          },
          {
            title: "Why",
            key: "why",
            width: 140,
            render: (_, i) => (
              <Tag color={REASONS[i.reason].color}>
                {REASONS[i.reason].label}
              </Tag>
            ),
          },
          {
            title: "",
            key: "detail",
            render: (_, i) => (
              <Typography.Text className={styles.small}>
                {i.detail}
              </Typography.Text>
            ),
          },
          {
            title: "",
            key: "actions",
            width: 170,
            render: (_, i) => (
              <Flex gap="small">
                <Button
                  size="small"
                  onClick={() => setKept((k) => [...k, i.key])}
                >
                  Keep
                </Button>
                <Button size="small" danger onClick={() => onRemove([i])}>
                  {i.principal ? "Remove" : "Unmap"}
                </Button>
              </Flex>
            ),
          },
        ]}
      />
    </>
  );
}
