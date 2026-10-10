"use client";

import { DeleteOutlined, DownloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  Popconfirm,
  Table,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import {
  KEYS,
  useCurrentUser,
  useIssuer,
  useIssuerCrls,
  useIssuers,
} from "@/lib/api/queries";
import type { NameConstraints, RevocationList } from "@/lib/api/types";
import { saveFile } from "@/lib/download";
import {
  describeDays,
  ekuName,
  formatDate,
  formatDateTime,
  SHAPES,
  STATUS_COLORS,
  windowClosed,
  TIERS,
} from "@/lib/labels";
import { SIGNS_LABEL, signsOf } from "@/lib/signs";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "./ErrorAlert";
import { IssuerTree } from "./IssuerTree";

const constraintLines = (constraints: NameConstraints): string[] =>
  (["permitted", "excluded"] as const).flatMap((kind) =>
    Object.entries(constraints[kind] ?? {})
      .filter(([, names]) => names?.length)
      .map(([type, names]) => `${kind} ${type}: ${names!.join(", ")}`),
  );

/** One CA: its certificate, its rules, what is beneath it and its lists. */
export function IssuerPage() {
  const issuerId = useSearchParams().get("id") ?? undefined;
  const { data: issuer, error: notFound } = useIssuer(issuerId);
  const { data: issuers } = useIssuers();
  const { data: crls } = useIssuerCrls(issuerId);
  const { isAdmin } = useCurrentUser();
  const { mutate } = useSWRConfig();
  const [error, setError] = useState<unknown>();

  if (!issuerId) return <Alert type="error" title="Which CA?" />;
  if (notFound) return <ErrorAlert error={notFound} />;
  if (!issuer) return null;

  const discarded = Boolean(issuer.discardedAt);
  const unused =
    issuer.tier === "root" &&
    !discarded &&
    !(issuers ?? []).some((other) => other.parentId === issuer.id) &&
    (crls ?? []).length === 0;
  const constraints = constraintLines(issuer.nameConstraints);

  const discard = async () => {
    try {
      unwrap(
        await apiClient.POST("/v1/issuer/{issuerId}/discard", {
          params: { path: { issuerId: issuer.id } },
        }),
      );
      setError(undefined);
      await Promise.all([mutate(KEYS.issuers), mutate(KEYS.issuer(issuer.id))]);
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="center" wrap gap="middle">
        <div>
          <Typography.Title level={3}>
            {commonName(issuer.subject)}
          </Typography.Title>
          <Flex gap="small">
            <Tag>{TIERS[issuer.tier]}</Tag>
            {issuer.shape && (
              <Tag color="blue">{SHAPES[issuer.shape].label}</Tag>
            )}
            <Tag color={STATUS_COLORS[issuer.status]}>
              {discarded ? "discarded" : issuer.status}
            </Tag>
            {issuer.offline && <Tag>offline</Tag>}
            {!discarded && windowClosed(issuer) && (
              <Tag color="orange">no longer signs</Tag>
            )}
          </Flex>
        </div>
        <Flex gap="small" wrap>
          {issuer.certificate && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() =>
                saveFile(
                  `${issuer.id}.crt.pem`,
                  issuer.certificate!,
                  "application/x-pem-file",
                )
              }
            >
              Certificate
            </Button>
          )}
          {issuer.offline && !discarded && issuer.status === "active" && (
            <Link href={`/ceremonies/new?issuerId=${issuer.id}`}>
              <Button type="primary">
                {issuer.provedAt ? "Open a ceremony" : "Prove the backup"}
              </Button>
            </Link>
          )}
          {unused && isAdmin && (
            <Popconfirm
              title="Discard this root?"
              description="It has signed nothing. It is never published, and its name and number are not used again."
              okText="Discard"
              okButtonProps={{ danger: true }}
              onConfirm={discard}
            >
              <Button danger icon={<DeleteOutlined />}>
                Discard
              </Button>
            </Popconfirm>
          )}
        </Flex>
      </Flex>
      <ErrorAlert error={error} />
      <Card>
        <Descriptions column={{ xs: 1, lg: 2 }} size="small">
          <Descriptions.Item label="Subject" span={2}>
            <Typography.Text code>{issuer.subject}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="ID">{issuer.id}</Descriptions.Item>
          <Descriptions.Item label="Parent">
            {issuer.parentId ? (
              <Link href={`/ca?id=${issuer.parentId}`}>{issuer.parentId}</Link>
            ) : (
              "—"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Valid">
            {formatDate(issuer.notBefore)} – {formatDate(issuer.notAfter)}
          </Descriptions.Item>
          <Descriptions.Item label="Issues until">
            {formatDate(issuer.issuingWindowClosesAt)}
          </Descriptions.Item>
          {issuer.offline && (
            <Descriptions.Item label="Signs">
              {SIGNS_LABEL[signsOf(issuer)]}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Longest certificate">
            {describeDays(issuer.maxValidityDays)}
          </Descriptions.Item>
          <Descriptions.Item label="Path length">
            {issuer.pathLength ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Extended key usages">
            {issuer.extendedKeyUsages.length
              ? issuer.extendedKeyUsages.map(ekuName).join(", ")
              : "Not restricted"}
          </Descriptions.Item>
          <Descriptions.Item label="Name constraints" span={2}>
            {constraints.length ? constraints.join("; ") : "None"}
          </Descriptions.Item>
          {issuer.offline && (
            <Descriptions.Item label="Key backup">
              {issuer.provedAt
                ? `Proved ${formatDateTime(issuer.provedAt)}`
                : "Not proved"}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Published" span={2}>
            <Flex vertical>
              <Typography.Text code>{issuer.caIssuersUrl}</Typography.Text>
              <Typography.Text code>{issuer.crlUrl}</Typography.Text>
            </Flex>
          </Descriptions.Item>
        </Descriptions>
      </Card>
      {issuer.tier !== "issuing" && (
        <Card title="Beneath it">
          <IssuerTree issuers={issuers ?? []} rootId={issuer.id} />
        </Card>
      )}
      {issuer.tier === "issuing" && (
        <Link href={`/certificates?issuerId=${issuer.id}`}>
          Certificates it issued
        </Link>
      )}
      <Card title="Revocation lists">
        <Table<RevocationList>
          rowKey="number"
          size="small"
          dataSource={crls ?? []}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          columns={[
            { title: "Number", dataIndex: "number" },
            { title: "Source", dataIndex: "source" },
            { title: "Entries", dataIndex: "entries" },
            {
              title: "This update",
              dataIndex: "thisUpdate",
              render: formatDateTime,
            },
            {
              title: "Next update",
              dataIndex: "nextUpdate",
              render: formatDate,
            },
            {
              title: "Published",
              dataIndex: "publishedAt",
              render: (publishedAt: string | undefined, list) =>
                publishedAt ? (
                  formatDateTime(publishedAt)
                ) : list.lastError ? (
                  <Typography.Text type="danger">
                    {list.lastError}
                  </Typography.Text>
                ) : (
                  <Tag color="gold">waiting</Tag>
                ),
            },
          ]}
        />
      </Card>
    </Flex>
  );
}
