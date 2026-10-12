import { Card, Flex, Progress, theme, Typography } from "antd";
import type { Dashboard } from "@/lib/api/types";
import styles from "./Dashboard.module.css";

/** Valid certificates by who renews them: one bar each, out of them all. */
export function RenewersCard({
  renewers,
}: {
  renewers: Dashboard["renewers"];
}) {
  const { token } = theme.useToken();
  const rows = [
    {
      label: "ACME",
      count: renewers.acme,
      note: "their clients order the next",
    },
    {
      label: "Harpocrates, to a deploy target",
      count: renewers.deployTarget,
      note: "renewed and installed",
    },
    {
      label: "Their holders, over mTLS",
      count: renewers.mtls,
      note: "as they renewed before",
    },
    { label: "A person", count: renewers.person, note: "nothing renews them" },
  ];
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <Card title="Who renews them" className={styles.graph}>
      <Flex vertical gap="middle">
        {rows.map((row) => (
          <div key={row.label}>
            <Flex justify="space-between" gap="small">
              <Typography.Text>{row.label}</Typography.Text>
              <Typography.Text strong className={styles.count}>
                {row.count}
              </Typography.Text>
            </Flex>
            <Progress
              percent={total ? Math.round((row.count / total) * 100) : 0}
              showInfo={false}
              size="small"
              strokeColor={token.colorPrimary}
              aria-label={`${row.label}: ${row.count} of ${total}`}
            />
            <Typography.Text type="secondary" className={styles.small}>
              {row.note}
            </Typography.Text>
          </div>
        ))}
      </Flex>
    </Card>
  );
}
