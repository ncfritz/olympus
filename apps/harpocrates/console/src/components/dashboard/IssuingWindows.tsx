import { Card, Empty, Flex, Progress, theme, Typography } from "antd";
import Link from "next/link";
import type { Issuer } from "@/lib/api/types";
import { timeUntil } from "@/lib/dashboard";
import { formatDate } from "@/lib/labels";
import { shortCaName } from "@/lib/tree";
import styles from "./Dashboard.module.css";

const YEAR = 365 * 24 * 60 * 60 * 1000;

/**
 * How long each active CA still issues (ADR 0020, Longevity): the share of
 * its window left; under a year, its successor is due.
 */
export function IssuingWindows({
  issuers,
  now,
}: {
  issuers: Issuer[];
  now: number;
}) {
  const { token } = theme.useToken();
  const windows = issuers
    .filter(
      (issuer) =>
        issuer.status === "active" &&
        !issuer.discardedAt &&
        issuer.notBefore &&
        issuer.issuingWindowClosesAt &&
        Date.parse(issuer.issuingWindowClosesAt) > now,
    )
    .map((issuer) => {
      const from = Date.parse(issuer.notBefore!);
      const closes = Date.parse(issuer.issuingWindowClosesAt!);
      return {
        issuer,
        closes,
        percent: Math.round(((closes - now) / (closes - from)) * 100),
      };
    })
    .sort((a, b) => a.closes - b.closes);

  return (
    <Card title="Issuing windows">
      {windows.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No active CA"
        />
      ) : (
        <Flex vertical gap="small">
          {windows.map(({ issuer, closes, percent }) => (
            <div key={issuer.id}>
              <Flex justify="space-between" gap="small">
                <Link href={`/ca?id=${issuer.id}`}>{shortCaName(issuer)}</Link>
                <Typography.Text
                  type="secondary"
                  title={`Stops issuing ${formatDate(issuer.issuingWindowClosesAt)}`}
                >
                  {timeUntil(issuer.issuingWindowClosesAt!, now)}
                </Typography.Text>
              </Flex>
              <Progress
                percent={percent}
                showInfo={false}
                size="small"
                strokeColor={
                  closes - now < YEAR ? token.colorWarning : token.colorSuccess
                }
                aria-label={`${shortCaName(issuer)}: ${percent}% of its issuing window left`}
              />
            </div>
          ))}
          <Typography.Text type="secondary" className={styles.small}>
            The share of each CA&apos;s window left. Under a year, its successor
            is due.
          </Typography.Text>
        </Flex>
      )}
    </Card>
  );
}
