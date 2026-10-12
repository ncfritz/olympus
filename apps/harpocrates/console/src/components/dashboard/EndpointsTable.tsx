import { Card, Table, Tag, Typography } from "antd";
import Link from "next/link";
import type { DeployTarget } from "@/lib/api/types";
import { formatDateTime, servingState } from "@/lib/labels";
import styles from "./Dashboard.module.css";

/** Whether each deploy target's endpoint serves what was issued for it. */
export function EndpointsTable({ targets }: { targets: DeployTarget[] }) {
  return (
    <Card
      title="Deployed versus issued"
      extra={<Link href="/deploy-targets">Deploy targets</Link>}
      classNames={{ body: styles.flushBody }}
    >
      <Table<DeployTarget>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={targets}
        scroll={{ x: true }}
        locale={{ emptyText: "No deploy targets" }}
        columns={[
          {
            title: "Target",
            key: "target",
            render: (_, target) => (
              <Link href={`/deploy-targets?id=${target.id}`}>
                {target.name}
              </Link>
            ),
          },
          {
            title: "Endpoint",
            dataIndex: "endpoint",
            ellipsis: true,
            render: (endpoint: string) => (
              <Typography.Text type="secondary">{endpoint}</Typography.Text>
            ),
          },
          {
            title: "Serving",
            key: "serving",
            render: (_, target) => {
              const { label, color } = servingState(target.lastObservation);
              return <Tag color={color}>{label}</Tag>;
            },
          },
          {
            title: "Stapling",
            key: "stapling",
            render: (_, target) => {
              const seen = target.lastObservation;
              if (seen?.stapled === undefined) return "—";
              if (seen.stapled) return <Tag color="green">Stapled</Tag>;
              return seen.servedMustStaple ? (
                <Tag color="red">Not stapled</Tag>
              ) : (
                <Tag>Not stapled</Tag>
              );
            },
          },
          {
            title: "Checked",
            key: "checked",
            render: (_, target) => (
              <Typography.Text type="secondary">
                {formatDateTime(target.lastObservation?.updatedAt)}
              </Typography.Text>
            ),
          },
        ]}
      />
    </Card>
  );
}
