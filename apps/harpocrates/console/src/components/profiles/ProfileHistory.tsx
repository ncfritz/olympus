import { Alert, Flex, Table, Tag, Typography } from "antd";
import { useState } from "react";
import type { ProfileVersion } from "@/lib/api/types";
import { formatDateTime } from "@/lib/labels";
import { changedSettings, settingsOf } from "@/lib/profileSettings";
import { ProfileDiff } from "./ProfileDiff";
import { PrincipalName } from "../PrincipalName";

/**
 * A profile's versions, newest first, each with what changed from the
 * one before; choose two to see every difference between them.
 */
export function ProfileHistory({ versions }: { versions: ProfileVersion[] }) {
  const [chosen, setChosen] = useState<number[]>(
    versions.length > 1 ? [versions[1].version, versions[0].version] : [],
  );
  const byNumber = new Map(versions.map((v) => [v.version, v]));
  const [older, newer] = [...chosen]
    .sort((a, b) => a - b)
    .map((n) => byNumber.get(n));

  return (
    <Flex vertical gap="large">
      <Table<ProfileVersion>
        rowKey="version"
        size="small"
        pagination={false}
        dataSource={versions}
        rowSelection={{
          selectedRowKeys: chosen,
          onChange: (keys) => setChosen((keys as number[]).slice(-2)),
          hideSelectAll: true,
        }}
        columns={[
          {
            title: "Version",
            dataIndex: "version",
            render: (version: number, row) => (
              <Flex gap={4}>
                <Tag>v{version}</Tag>
                {row.version === versions[0].version && (
                  <Tag color="blue">latest</Tag>
                )}
              </Flex>
            ),
          },
          {
            title: "Changed",
            key: "changed",
            render: (_, row) => {
              const previous = byNumber.get(row.version - 1);
              if (!previous) return "First version";
              const changes = changedSettings(
                settingsOf(previous),
                settingsOf(row),
              );
              return changes.map((c) => c.label).join(", ") || "Nothing";
            },
          },
          {
            title: "By",
            dataIndex: "createdBy",
            render: (by: string) =>
              by === "migration" ? "Seeded" : <PrincipalName principal={by} />,
          },
          {
            title: "Made",
            dataIndex: "createdAt",
            render: (at: string) => formatDateTime(at),
          },
        ]}
      />
      {older && newer ? (
        <Flex vertical gap="small">
          <Typography.Title level={5}>
            v{older.version} to v{newer.version}
          </Typography.Title>
          <ProfileDiff
            before={settingsOf(older)}
            after={settingsOf(newer)}
            beforeTitle={`v${older.version}`}
            afterTitle={`v${newer.version}`}
          />
        </Flex>
      ) : (
        <Alert
          type="info"
          showIcon
          title={
            versions.length > 1
              ? "Choose two versions to compare them."
              : "It has one version: nothing to compare yet."
          }
        />
      )}
    </Flex>
  );
}
