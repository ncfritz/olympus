"use client";

import { Flex, Table, Tag, Typography } from "antd";
import { useProfiles } from "@/lib/api/queries";
import type { Profile } from "@/lib/api/types";
import { describeDays, ekuName } from "@/lib/labels";
import { ErrorAlert } from "./ErrorAlert";

/** What a certificate may be (ADR 0020, Profiles), and how its key is kept. */
export function ProfilesPage() {
  const { data: profiles, error, isLoading } = useProfiles();
  return (
    <Flex vertical gap="large">
      <Typography.Title level={3}>Profiles</Typography.Title>
      <ErrorAlert error={error} />
      <Table<Profile>
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={false}
        dataSource={profiles ?? []}
        expandable={{
          expandedRowRender: (profile) => (
            <Typography.Text type="secondary">
              {profile.description}
            </Typography.Text>
          ),
        }}
        columns={[
          { title: "Profile", dataIndex: "id" },
          { title: "Issued by", dataIndex: "issuerPurpose" },
          { title: "Key", dataIndex: "keyAlgorithm" },
          {
            title: "Validity",
            dataIndex: "validityDays",
            render: describeDays,
          },
          {
            title: "Usages",
            dataIndex: "extendedKeyUsages",
            render: (oids: string[]) => oids.map(ekuName).join(", ") || "—",
          },
          {
            title: "Enrollment",
            key: "enrollment",
            render: (_, p) =>
              [p.allowCsr && "CSR", p.allowGenerated && "generated"]
                .filter(Boolean)
                .join(", "),
          },
          {
            title: "Escrow",
            key: "escrow",
            render: (_, p) => (
              <Flex gap={4} wrap>
                <Tag color={p.escrow ? "blue" : "default"}>
                  {p.escrow ? "kept" : "exported once"}
                </Tag>
                {p.escrowOverridable && <Tag>per certificate</Tag>}
              </Flex>
            ),
          },
          {
            title: "",
            key: "flags",
            render: (_, p) => (
              <Flex gap={4} wrap>
                {p.directOnly && <Tag color="purple">root signs directly</Tag>}
                {p.extensions === "minimal" && <Tag>key identifiers only</Tag>}
                {p.legacyExport && <Tag>legacy export</Tag>}
              </Flex>
            ),
          },
        ]}
      />
    </Flex>
  );
}
