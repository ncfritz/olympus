"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Button, Flex, Segmented, Table, Tag, Typography } from "antd";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useCurrentUser, useProfiles } from "@/lib/api/queries";
import type { Profile } from "@/lib/api/types";
import { describeDays, ekuName } from "@/lib/labels";
import { ErrorAlert } from "./ErrorAlert";
import { ProfilePage } from "./profiles/ProfilePage";

type Shown = "active" | "all";

/**
 * Profiles (ADR 0020, Profiles; ADR 0034): what a certificate may be,
 * each read as its latest version. One opens from `?id=`.
 */
export function ProfilesPage() {
  const params = useSearchParams();
  const open = params.get("id");
  const [shown, setShown] = useState<Shown>("active");
  const { data: profiles, error, isLoading } = useProfiles();
  const { isAdmin } = useCurrentUser();

  if (open) return <ProfilePage profileId={open} />;

  const listed = (profiles ?? []).filter((p) => shown === "all" || p.active);
  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="center" wrap gap="middle">
        <Typography.Title level={3}>Profiles</Typography.Title>
        <Flex gap="small" align="center">
          <Segmented<Shown>
            value={shown}
            onChange={setShown}
            options={[
              { value: "active", label: "Active" },
              {
                value: "all",
                label: `All (${profiles?.length ?? "…"})`,
              },
            ]}
          />
          {isAdmin && (
            <Link href="/profiles/new">
              <Button type="primary" icon={<PlusOutlined />}>
                New profile
              </Button>
            </Link>
          )}
        </Flex>
      </Flex>
      <ErrorAlert error={error} />
      <Table<Profile>
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={false}
        dataSource={listed}
        columns={[
          {
            title: "Profile",
            dataIndex: "id",
            render: (id: string, p) => (
              <Flex vertical>
                <Link href={`/profiles?id=${id}`}>{id}</Link>
                <Typography.Text type="secondary">
                  {p.description}
                </Typography.Text>
              </Flex>
            ),
          },
          { title: "Issued by", dataIndex: "issuerPurpose" },
          { title: "Key", dataIndex: "keyAlgorithm" },
          {
            title: "Validity",
            key: "validity",
            render: (_, p) =>
              p.ssh
                ? `${p.ssh.validityHours} hours`
                : describeDays(p.validityDays),
          },
          {
            title: "Usages",
            dataIndex: "extendedKeyUsages",
            render: (usages: Profile["extendedKeyUsages"]) =>
              usages
                .filter((u) => u.state === "forced" || u.state === "default")
                .map((u) => ekuName(u.oid))
                .join(", ") || "—",
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
            title: "",
            key: "flags",
            render: (_, p) => (
              <Flex gap={4} wrap>
                <Tag>v{p.version}</Tag>
                {p.kind === "ssh" && <Tag color="geekblue">SSH</Tag>}
                {!p.active && <Tag color="red">inactive</Tag>}
                {p.directOnly && <Tag color="purple">root signs directly</Tag>}
                {p.extensions === "minimal" && <Tag>key identifiers only</Tag>}
                {p.escrow && <Tag color="blue">escrow</Tag>}
              </Flex>
            ),
          },
        ]}
      />
    </Flex>
  );
}
