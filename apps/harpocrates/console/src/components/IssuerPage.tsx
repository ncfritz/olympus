"use client";

import {
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  ImportOutlined,
  ProfileOutlined,
} from "@ant-design/icons";
import { SideTabPanel } from "@ncfritz/olympus-console";
import {
  Alert,
  Button,
  Descriptions,
  Dropdown,
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
  useSignerStatus,
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
import { CeremonyList } from "./CeremonyList";
import { ErrorAlert } from "./ErrorAlert";
import { ImportChildCaModal } from "./imports/ImportChildCaModal";
import { ImportCrlModal } from "./imports/ImportCrlModal";
import { ImportIssuerCsrModal } from "./imports/ImportIssuerCsrModal";
import { ImportLeafModal } from "./imports/ImportLeafModal";
import { IssuedChart } from "./IssuedChart";
import { IssuerAltNamesModal } from "./IssuerAltNamesModal";
import { IssuerOcspPanel } from "./IssuerOcspPanel";
import { OcspUrlModal } from "./OcspUrlModal";
import { OpenCeremonyAlert } from "./OpenCeremonyAlert";
import { OpenCeremonyModal } from "./OpenCeremonyModal";
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
const Mono = ({
  children,
  small,
}: {
  children: ReactNode;
  /** A long value (an ID, a URL), a size down. */
  small?: boolean;
}) => (
  <span className={`${styles.mono} ${small ? styles.small : ""}`}>
    {children}
  </span>
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
  const query = useSearchParams();
  const issuerId = query.get("id") ?? undefined;
  // `?ceremony=open` comes from where a ceremony was asked for (a new
  // root's handover, the roots page): the dialog opens with the page.
  const [opening, setOpening] = useState(query.get("ceremony") === "open");
  const { data: signer } = useSignerStatus();
  const { data: issuer, error: notFound } = useIssuer(issuerId);
  const { data: issuers } = useIssuers();
  const { data: crls } = useIssuerCrls(issuerId);
  const { data: issued } = useIssued(issuerId);
  const { isAdmin } = useCurrentUser();
  const { mutate } = useSWRConfig();
  const [error, setError] = useState<unknown>();
  const [editingNames, setEditingNames] = useState(false);
  const [editingOcspUrl, setEditingOcspUrl] = useState(false);
  const [importing, setImporting] = useState<
    "child" | "leaf" | "csr" | "crl"
  >();

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
  /** Where an admin imports what XCA made beneath it, and its list. */
  const importable = isAdmin && !discarded && Boolean(issuer.certificate);
  /** What its Import menu offers: what is beneath it; an XCA CA's missing CSR and list. */
  const imports = [
    issuer.tier === "issuing"
      ? { key: "leaf" as const, label: "A certificate it signed" }
      : { key: "child" as const, label: "A child CA" },
    ...(issuer.importedAt && !issuer.csr
      ? [{ key: "csr" as const, label: "Its CSR" }]
      : []),
    // XCA's newest list, until one has been brought in: lists signed
    // here (a ceremony's, the signer's) do not take its place.
    ...(issuer.importedAt &&
    crls &&
    !crls.some((list) => list.source === "imported")
      ? [{ key: "crl" as const, label: "Its revocation list" }]
      : []),
  ];
  /** An offline CA that can sit: its key comes back only in a ceremony. */
  const ceremonial = issuer.offline && !discarded && issuer.status === "active";

  const [leftFields, rightFields] = columnsOf(
    [
      { key: "id", label: "ID", children: <Mono small>{issuer.id}</Mono> },
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
            <Mono small>{issuer.caIssuersUrl}</Mono>
            <Mono small>{issuer.crlUrl}</Mono>
          </Flex>
        ),
      },
      {
        key: "ocsp",
        label: "OCSP",
        children: (
          <Flex gap="small" align="baseline" wrap>
            <Mono small>{issuer.ocspUrl}</Mono>
            {isAdmin && !discarded && (
              <Button
                type="link"
                size="small"
                onClick={() => setEditingOcspUrl(true)}
              >
                Edit
              </Button>
            )}
          </Flex>
        ),
      },
      // Only a CA that signs leaves gives them its alternative names.
      (issuer.tier === "issuing" || issuer.shape === "direct") && {
        key: "alternativeNames",
        label: "Alternative names",
        children: (
          <Flex gap="small" align="baseline" wrap>
            <span>
              {[
                ...(issuer.alternativeNames.email ?? []),
                ...(issuer.alternativeNames.uri ?? []),
              ].join(", ") || "None"}
            </span>
            {isAdmin && (
              <Button
                type="link"
                size="small"
                onClick={() => setEditingNames(true)}
              >
                Edit
              </Button>
            )}
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
    ...(issuer.csr
      ? [
          {
            key: "csr",
            label: (
              <TabIcon
                title="Certificate request"
                icon={<FileProtectOutlined />}
              />
            ),
            children: <PemBlock pem={issuer.csr} />,
          },
        ]
      : []),
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
      {ceremonial && !issuer.provedAt && (
        <Alert
          type="info"
          showIcon
          banner
          title="Prove the backup"
          description="Bring its key back from the offline media and open a ceremony with it: until then, nothing shows the backup can be restored, and it signs nothing."
          action={
            <Button
              size="small"
              disabled={Boolean(signer?.ceremonyId) || !isAdmin}
              onClick={() => setOpening(true)}
            >
              Prove the backup
            </Button>
          }
        />
      )}
      <Flex
        justify="space-between"
        align="center"
        wrap
        gap="middle"
        className={styles.header}
      >
        <Typography.Title level={3} className={styles.title}>
          {commonName(issuer.subject)}
        </Typography.Title>
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
          {importable && (
            <Dropdown
              trigger={["click"]}
              menu={{
                items: imports,
                onClick: ({ key }) => setImporting(key as typeof importing),
              }}
            >
              <Button icon={<ImportOutlined />}>
                Import <DownOutlined />
              </Button>
            </Dropdown>
          )}
          {ceremonial && issuer.provedAt && (
            <Button
              type="primary"
              disabled={Boolean(signer?.ceremonyId) || !isAdmin}
              onClick={() => setOpening(true)}
            >
              Open a ceremony
            </Button>
          )}
          {unused && isAdmin && (
            <Popconfirm
              title="Discard this root?"
              description="It has signed nothing. It is never published, and its name and number are not used again."
              okText="Discard"
              okButtonProps={{ danger: true }}
              onConfirm={discard}
            >
              <Button type="primary" danger icon={<DeleteOutlined />}>
                Discard
              </Button>
            </Popconfirm>
          )}
        </Flex>
      </Flex>
      {issuer.offline && !discarded && <OpenCeremonyAlert />}
      {Boolean(error) && (
        <div className={styles.padded}>
          <ErrorAlert error={error} />
        </div>
      )}
      {importable && (
        <>
          {issuer.tier === "issuing" ? (
            <ImportLeafModal
              issuer={issuer}
              open={importing === "leaf"}
              onClose={() => setImporting(undefined)}
            />
          ) : (
            <ImportChildCaModal
              parent={issuer}
              open={importing === "child"}
              onClose={() => setImporting(undefined)}
            />
          )}
          <ImportIssuerCsrModal
            issuer={issuer}
            open={importing === "csr"}
            onClose={() => setImporting(undefined)}
          />
          <ImportCrlModal
            issuer={issuer}
            open={importing === "crl"}
            onClose={() => setImporting(undefined)}
          />
        </>
      )}
      {ceremonial && (
        <OpenCeremonyModal
          issuer={issuer}
          open={opening && !signer?.ceremonyId}
          onClose={() => setOpening(false)}
        />
      )}
      <Flex vertical gap="small" className={styles.details}>
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
        className={styles.tabs}
        items={[
          {
            key: "certificates",
            label: "Certificates",
            children: (
              <SignedList issuerId={issuer.id} issuers={issuers ?? []} />
            ),
          },
          ...(issuer.offline
            ? [
                {
                  key: "ceremonies",
                  label: "Ceremonies",
                  children: <CeremonyList issuerId={issuer.id} />,
                },
              ]
            : []),
          ...(issuer.certificate && !discarded
            ? [
                {
                  key: "ocsp",
                  label: "OCSP",
                  children: (
                    <div className={styles.tabPadded}>
                      <IssuerOcspPanel issuer={issuer} />
                    </div>
                  ),
                },
              ]
            : []),
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
      <IssuerAltNamesModal
        issuer={issuer}
        open={editingNames}
        onClose={() => setEditingNames(false)}
      />
      <OcspUrlModal
        issuer={issuer}
        open={editingOcspUrl}
        onClose={() => setEditingOcspUrl(false)}
      />
    </SideTabPanel>
  );
}
