"use client";

import {
  DeleteOutlined,
  DownloadOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  ProfileOutlined,
} from "@ant-design/icons";
import { SideTabPanel } from "@ncfritz/olympus-console";
import {
  Alert,
  Button,
  Descriptions,
  Flex,
  Popconfirm,
  Table,
  Tabs,
  Tag,
  Tooltip,
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
  useIssued,
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
import {
  CertificateDetails,
  CertificatePem,
  PemBlock,
} from "./CertificateDetails";
import { ErrorAlert } from "./ErrorAlert";
import { IssuedChart } from "./IssuedChart";
import styles from "./IssuerPage.module.css";
import { SignedList } from "./SignedList";

const constraintLines = (constraints: NameConstraints): string[] =>
  (["permitted", "excluded"] as const).flatMap((kind) =>
    Object.entries(constraints[kind] ?? {})
      .filter(([, names]) => names?.length)
      .map(([type, names]) => `${kind} ${type}: ${names!.join(", ")}`),
  );

/** One of the details' fields. */
type Field = { key: string; label: string; children: ReactNode };

type Fields = (Field | false | undefined)[];

/**
 * The details as two columns that run independently: the fields alternate
 * between them, then the tags continue the right-hand one and the rest
 * (name constraints, the published URLs) the left-hand one, so neither
 * waits for the other.
 */
const columnsOf = (
  fields: Fields,
  right: Fields,
  left: Fields,
): [Field[], Field[]] => {
  const present = (list: Fields) => list.filter((f): f is Field => Boolean(f));
  const singles = present(fields);
  return [
    [...singles.filter((_, i) => i % 2 === 0), ...present(left)],
    [...singles.filter((_, i) => i % 2 === 1), ...present(right)],
  ];
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

/** A side tab's label: its icon, named in a tooltip. */
const TabIcon = ({ title, icon }: { title: string; icon: ReactNode }) => (
  <Tooltip title={title} placement="left">
    <span aria-label={title}>{icon}</span>
  </Tooltip>
);

/** The side panel's width, open. */
const PANEL_WIDTH = 560;

/**
 * One CA: its rules, what is beneath it and its lists; in a side panel,
 * its certificate's details, its CSR and its PEM.
 */
export function IssuerPage() {
  const issuerId = useSearchParams().get("id") ?? undefined;
  const { data: issuer, error: notFound } = useIssuer(issuerId);
  const { data: issuers } = useIssuers();
  const { data: crls } = useIssuerCrls(issuerId);
  const { data: issued } = useIssued(issuerId);
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

  const [leftFields, rightFields] = columnsOf(
    [
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
    ],
    [
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
    ],
    [
      {
        key: "constraints",
        label: "Name constraints",
        children: constraints.length ? constraints.join("; ") : "None",
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
      },
    ],
  );

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

  const none = (text: string) => (
    <Typography.Text type="secondary">{text}</Typography.Text>
  );
  const sideTabs = [
    {
      key: "details",
      label: <TabIcon title="Certificate details" icon={<ProfileOutlined />} />,
      children: issuer.certificate ? (
        <CertificateDetails
          pem={issuer.certificate}
          nameConstraints={constraints}
        />
      ) : (
        none("It has no certificate yet.")
      ),
    },
    {
      key: "csr",
      label: (
        <TabIcon title="Certificate request" icon={<FileProtectOutlined />} />
      ),
      children: issuer.csr ? (
        <PemBlock pem={issuer.csr} />
      ) : (
        none(
          issuer.tier === "root"
            ? "A root signs itself: it has no CSR."
            : "Its certificate was made here, from its key: there is no CSR.",
        )
      ),
    },
    {
      key: "pem",
      label: <TabIcon title="Certificate (PEM)" icon={<FileTextOutlined />} />,
      children: issuer.certificate ? (
        <CertificatePem pem={issuer.certificate} fileName={issuer.id} />
      ) : (
        none("It has no certificate yet.")
      ),
    },
  ];

  return (
    <SideTabPanel
      panelId="harpocrates.ca"
      tabs={sideTabs}
      width={PANEL_WIDTH}
      className={styles.page}
    >
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
        <Flex vertical gap="small">
          <Descriptions
            column={1}
            size="small"
            classNames={{ label: styles.label }}
            items={[
              {
                key: "subject",
                label: "Subject",
                children: <Mono>{issuer.subject}</Mono>,
              },
            ]}
          />
          <Flex wrap gap={64}>
            {[leftFields, rightFields].map((fields, index) => (
              <Descriptions
                key={index}
                className={styles.column}
                column={1}
                size="small"
                classNames={{
                  label: index === 0 ? styles.label : styles.rightLabel,
                }}
                items={fields}
              />
            ))}
            {issued && <IssuedChart counts={issued} />}
          </Flex>
        </Flex>
        <Tabs
          items={[
            {
              key: "certificates",
              label: "Certificates",
              children: (
                <SignedList issuerId={issuer.id} issuers={issuers ?? []} />
              ),
            },
            {
              key: "crls",
              label: "Revocation lists",
              children: (
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
              ),
            },
          ]}
        />
      </Flex>
    </SideTabPanel>
  );
}
