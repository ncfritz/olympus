"use client";

import { Alert, Table, Tag } from "antd";
import Link from "next/link";
import {
  useCurrentUser,
  useIssuerCeremonies,
  useSignerStatus,
} from "@/lib/api/queries";
import type { CeremonySummary } from "@/lib/api/types";
import { formatDateTime } from "@/lib/labels";
import { PrincipalName } from "./PrincipalName";

/**
 * An offline CA's ceremonies, newest first: who opened each, when, and
 * whether it is open, closed or ended without being closed (timed out,
 * sealed or restarted: the signer forgot the key either way).
 */
export function CeremonyList({ issuerId }: { issuerId: string }) {
  const { isAdmin } = useCurrentUser();
  const { data: ceremonies, isLoading } = useIssuerCeremonies(
    isAdmin ? issuerId : undefined,
  );
  const { data: status } = useSignerStatus();
  if (!isAdmin) {
    return (
      <Alert
        type="info"
        showIcon
        title="Ceremonies are a pki-admin's"
        description="Ask one to see this CA's ceremonies."
      />
    );
  }
  return (
    <Table<CeremonySummary>
      rowKey="id"
      size="small"
      loading={isLoading}
      dataSource={ceremonies ?? []}
      pagination={{
        pageSize: 20,
        size: "small",
        showSizeChanger: false,
        showTotal: (total) => `${total} ceremonies`,
      }}
      locale={{ emptyText: "No ceremonies yet" }}
      columns={[
        {
          title: "Opened",
          dataIndex: "openedAt",
          render: (openedAt: string, ceremony) => (
            <Link href={`/ceremony?id=${ceremony.id}`}>
              {formatDateTime(openedAt)}
            </Link>
          ),
        },
        {
          title: "By",
          dataIndex: "principal",
          render: (principal: string) => (
            <PrincipalName principal={principal} />
          ),
        },
        {
          title: "Closed",
          dataIndex: "closedAt",
          render: (closedAt?: string) =>
            closedAt ? formatDateTime(closedAt) : "—",
        },
        { title: "Lists signed", dataIndex: "crlsSigned" },
        {
          title: "State",
          key: "state",
          render: (_, ceremony) =>
            ceremony.closedAt ? (
              <Tag>closed</Tag>
            ) : ceremony.id === status?.ceremonyId ? (
              <Tag color="gold">open</Tag>
            ) : (
              <Tag>ended</Tag>
            ),
        },
      ]}
    />
  );
}
