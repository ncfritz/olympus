"use client";

import { DeleteOutlined, DownloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  type DescriptionsProps,
  Flex,
  Popconfirm,
  Table,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
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
import styles from "./IssuerPage.module.css";
import { IssuerTree } from "./IssuerTree";

const constraintLines = (constraints: NameConstraints): string[] =>
  (["permitted", "excluded"] as const).flatMap((kind) =>
    Object.entries(constraints[kind] ?? {})
      .filter(([, names]) => names?.length)
      .map(([type, names]) => `${kind} ${type}: ${names!.join(", ")}`),
  );

/**
 * The details' fields, two to a row, a wide one on a row of its own: the
 * single field before a wide one fills the rest of its row.
 */
type Field = { key: string; label: string; children: ReactNode; wide?: true };

const toRows = (
  fields: (Field | false | undefined)[],
): DescriptionsProps["items"] => {
  const present = fields.filter((f): f is Field => Boolean(f));
  let column = 0;
  return present.map((field, index) => {
    if (field.wide) {
      column = 0;
      return {
        key: field.key,
        label: field.label,
        children: field.children,
        span: 2,
      };
    }
    const next = present[index + 1];
    const fills = column === 0 && (!next || next.wide);
    column = fills ? 0 : (column + 1) % 2;
    return {
      key: field.key,
      label: field.label,
      children: field.children,
      ...(fills ? { span: "filled" as const } : {}),
    };
  });
};

/** A value in the theme's code font, without code formatting. */
const Mono = ({ children }: { children: ReactNode }) => (
  <span className={styles.mono}>{children}</span>
);

/** A tag in the details: all the same width. */
const DetailTag = ({
  color,
  children,
}: {
  color?: string;
  children: ReactNode;
}) => (
  <Tag color={color} className={styles.tag}>
    {children}
  </Tag>
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
      <Card variant="borderless">
        <Descriptions
          column={{ xs: 1, lg: 2 }}
          size="small"
          classNames={{ label: styles.label }}
          items={toRows([
            {
              key: "subject",
              label: "Subject",
              children: <Mono>{issuer.subject}</Mono>,
              wide: true,
            },
            { key: "id", label: "ID", children: <Mono>{issuer.id}</Mono> },
            Boolean(issuer.parentId) && {
              key: "parent",
              label: "Parent",
              children: (
                <Link href={`/ca?id=${issuer.parentId}`}>
                  <Mono>{issuer.parentId}</Mono>
                </Link>
              ),
            },
            {
              key: "valid",
              label: "Valid",
              children: `${formatDate(issuer.notBefore)} – ${formatDate(issuer.notAfter)}`,
            },
            {
              key: "issuesUntil",
              label: "Issues until",
              children: formatDate(issuer.issuingWindowClosesAt),
            },
            issuer.offline && {
              key: "signs",
              label: "Signs",
              children: SIGNS_LABEL[signsOf(issuer)],
            },
            {
              key: "longest",
              label: "Longest certificate",
              children: describeDays(issuer.maxValidityDays),
            },
            {
              key: "pathLength",
              label: "Path length",
              children: issuer.pathLength ?? "—",
            },
            {
              key: "ekus",
              label: "Extended key usages",
              children: issuer.extendedKeyUsages.length
                ? issuer.extendedKeyUsages.map(ekuName).join(", ")
                : "Not restricted",
            },
            issuer.offline && {
              key: "backup",
              label: "Key backup",
              children: issuer.provedAt
                ? `Proved ${formatDateTime(issuer.provedAt)}`
                : "Not proved",
            },
            {
              key: "tier",
              label: "Tier",
              children: <DetailTag>{TIERS[issuer.tier]}</DetailTag>,
            },
            issuer.shape && {
              key: "shape",
              label: "Shape",
              children: (
                <DetailTag color="blue">{SHAPES[issuer.shape].label}</DetailTag>
              ),
            },
            {
              key: "status",
              label: "Status",
              children: (
                <DetailTag color={STATUS_COLORS[issuer.status]}>
                  {discarded ? "discarded" : issuer.status}
                </DetailTag>
              ),
            },
            {
              key: "key",
              label: "Key",
              children: (
                <DetailTag>{issuer.offline ? "offline" : "online"}</DetailTag>
              ),
            },
            !discarded &&
              windowClosed(issuer) && {
                key: "signing",
                label: "Signing",
                children: <DetailTag color="orange">no longer signs</DetailTag>,
              },
            {
              key: "constraints",
              label: "Name constraints",
              children: constraints.length ? constraints.join("; ") : "None",
              wide: true,
            },
            {
              key: "published",
              label: "Published",
              children: (
                <Flex vertical>
                  <Mono>{issuer.caIssuersUrl}</Mono>
                  <Mono>{issuer.crlUrl}</Mono>
                </Flex>
              ),
              wide: true,
            },
          ])}
        />
      </Card>
      {issuer.tier !== "issuing" && (
        <Card title="Beneath it" variant="borderless">
          <IssuerTree issuers={issuers ?? []} rootId={issuer.id} />
        </Card>
      )}
      {issuer.tier === "issuing" && (
        <Link href={`/certificates?issuerId=${issuer.id}`}>
          Certificates it issued
        </Link>
      )}
      <Card title="Revocation lists" variant="borderless">
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
