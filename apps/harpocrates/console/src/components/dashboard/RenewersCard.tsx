import { Flex, Progress, theme, Tooltip, Typography } from "antd";
import type { Dashboard } from "@/lib/api/types";
import styles from "./Dashboard.module.css";
import { GraphBox } from "./GraphBox";

/**
 * Valid certificates by who renews them: one bar each, out of them all,
 * compact enough to sit level with the graphs beside it.
 */
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
      note: "Their clients order the next",
    },
    {
      label: "Deploy targets",
      count: renewers.deployTarget,
      note: "Harpocrates renews and installs them",
    },
    {
      label: "Holders, over mTLS",
      count: renewers.mtls,
      note: "They renew themselves, as they did before",
    },
    { label: "A person", count: renewers.person, note: "Nothing renews them" },
  ];
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <GraphBox title="Who renews them">
      <Flex vertical gap={10} className={styles.renewers}>
        {rows.map((row) => (
          <div key={row.label}>
            <Flex justify="space-between" gap="small">
              <Tooltip title={row.note} placement="left">
                <Typography.Text>{row.label}</Typography.Text>
              </Tooltip>
              <Typography.Text strong className={styles.count}>
                {row.count}
              </Typography.Text>
            </Flex>
            <Progress
              percent={total ? Math.round((row.count / total) * 100) : 0}
              showInfo={false}
              size="small"
              strokeColor={token.colorPrimary}
              className={styles.bar}
              aria-label={`${row.label}: ${row.count} of ${total}`}
            />
          </div>
        ))}
      </Flex>
    </GraphBox>
  );
}
