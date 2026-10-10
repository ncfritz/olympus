"use client";

import { Alert, Button, Card, Flex, Table, Tag, Typography } from "antd";
import Link from "next/link";
import { useIssuers, useSignerStatus } from "@/lib/api/queries";
import type { Issuer } from "@/lib/api/types";
import { formatDate, STATUS_COLORS, TIERS } from "@/lib/labels";
import { SIGNS_LABEL, signsOf } from "@/lib/signs";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "./ErrorAlert";

/**
 * Ceremonies (ADR 0020): the one open now, if any, and the offline CAs
 * that can hold one, with what each signs.
 */
export function CeremoniesPage() {
  const { data: status } = useSignerStatus();
  const { data: issuers, error } = useIssuers();
  const offline = (issuers ?? []).filter(
    (issuer) => issuer.offline && !issuer.discardedAt,
  );

  return (
    <Flex vertical gap="large">
      <div>
        <Typography.Title level={3}>Ceremonies</Typography.Title>
        <Typography.Text type="secondary">
          An offline CA&apos;s key, given back from the offline media and held
          by the signer for one sitting, to sign what it signs.
        </Typography.Text>
      </div>
      {status?.ceremonyId ? (
        <Alert
          type="info"
          showIcon
          title="A ceremony is open"
          action={
            <Link href={`/ceremony?id=${status.ceremonyId}`}>
              <Button size="small" type="primary">
                Go to it
              </Button>
            </Link>
          }
        />
      ) : (
        <Typography.Text>No ceremony is open.</Typography.Text>
      )}
      <ErrorAlert error={error} />
      <Card title="Offline CAs">
        <Table<Issuer>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={offline}
          columns={[
            {
              title: "CA",
              key: "name",
              render: (_, issuer) => (
                <Link href={`/ca?id=${issuer.id}`}>
                  {commonName(issuer.subject)}
                </Link>
              ),
            },
            {
              title: "Tier",
              dataIndex: "tier",
              render: (tier: Issuer["tier"]) => TIERS[tier],
            },
            {
              title: "Signs",
              key: "signs",
              render: (_, issuer) => SIGNS_LABEL[signsOf(issuer)],
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (s: Issuer["status"]) => (
                <Tag color={STATUS_COLORS[s]}>{s}</Tag>
              ),
            },
            {
              title: "Backup",
              dataIndex: "provedAt",
              render: (provedAt?: string) =>
                provedAt ? (
                  `Proved ${formatDate(provedAt)}`
                ) : (
                  <Tag color="gold">Not proved</Tag>
                ),
            },
            {
              title: "",
              key: "open",
              render: (_, issuer) =>
                issuer.status === "active" ? (
                  <Link href={`/ceremonies/new?issuerId=${issuer.id}`}>
                    <Button size="small" disabled={Boolean(status?.ceremonyId)}>
                      {issuer.provedAt ? "Open" : "Prove the backup"}
                    </Button>
                  </Link>
                ) : null,
            },
          ]}
        />
      </Card>
    </Flex>
  );
}
