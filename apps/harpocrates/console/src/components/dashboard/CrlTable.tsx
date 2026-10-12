import { Card, Table, Tag, Typography } from "antd";
import Link from "next/link";
import type { DashboardCrl, Issuer } from "@/lib/api/types";
import { timeUntil } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/labels";
import { shortCaName } from "@/lib/tree";
import styles from "./Dashboard.module.css";

const DAY = 24 * 60 * 60 * 1000;

/** Each active CA's newest list: its number, when it lapses, and whether it is out. */
export function CrlTable({
  crls,
  issuers,
  now,
}: {
  crls: DashboardCrl[];
  issuers: Issuer[];
  now: number;
}) {
  const names = new Map(issuers.map((i) => [i.id, shortCaName(i)]));
  return (
    <Card
      title="Revocation lists"
      extra={<Link href="/roots">CAs</Link>}
      classNames={{ body: styles.flushBody }}
    >
      <Table<DashboardCrl>
        rowKey="issuerId"
        size="small"
        pagination={false}
        dataSource={crls}
        scroll={{ x: true }}
        columns={[
          {
            title: "CA",
            key: "ca",
            render: (_, crl) => (
              <Link href={`/ca?id=${crl.issuerId}`}>
                {names.get(crl.issuerId) ?? crl.issuerId}
              </Link>
            ),
          },
          {
            title: "Number",
            dataIndex: "number",
            render: (number?: string) => (
              <Typography.Text code>{number ?? "—"}</Typography.Text>
            ),
          },
          {
            title: "Lapses in",
            key: "lapses",
            render: (_, crl) => {
              if (!crl.nextUpdate) return "—";
              const left = Date.parse(crl.nextUpdate) - now;
              const soon = crl.offline ? left < 60 * DAY : left < 2 * DAY;
              return (
                <Typography.Text type={soon ? "danger" : undefined}>
                  {timeUntil(crl.nextUpdate, now)}
                </Typography.Text>
              );
            },
          },
          {
            title: "Published",
            key: "published",
            render: (_, crl) =>
              crl.number === undefined ? (
                <Tag>None yet</Tag>
              ) : crl.publishedAt ? (
                <Tag color="green" title={formatDateTime(crl.publishedAt)}>
                  Published
                </Tag>
              ) : (
                <Tag color="gold">Waiting</Tag>
              ),
          },
        ]}
      />
    </Card>
  );
}
