"use client";

import {
  DeploymentUnitOutlined,
  DownloadOutlined,
  FileAddOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  HistoryOutlined,
  ImportOutlined,
  KeyOutlined,
  ProfileOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  Button,
  Dropdown,
  Flex,
  message,
  Modal,
  Skeleton,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { SideTabPanel } from "@ncfritz/olympus-console";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import {
  KEYS,
  useCertificate,
  useCertificateLineages,
  useCurrentUser,
  useDashboard,
  useDeployTargets,
  useIssuers,
  useSubjectEvents,
} from "@/lib/api/queries";
import { lineageOf, RENEWED_BY, targetsOf } from "@/lib/certificatePage";
import { HEALTH, timeUntil } from "@/lib/dashboard";
import { saveFile } from "@/lib/download";
import { formatDate, formatDateTime } from "@/lib/labels";
import { shortCaName } from "@/lib/tree";
import { AddCsrForm, AddKeyForm } from "../AddKeyForms";
import { Count, CountStrip } from "../CountStrip";
import { DeployTargetForm } from "../DeployTargetForm";
import { ErrorAlert } from "../ErrorAlert";
import { KeyExportForm } from "../KeyExportForm";
import { RenewForm } from "../RenewForm";
import { RevokeForm } from "../RevokeForm";
import styles from "./Certificate.module.css";
import { CertificateDetails, CertificatePem } from "../CertificateDetails";
import { Chain } from "./Chain";
import { Details } from "./Details";
import { Overview } from "./Overview";
import { Activity } from "./SideTabs";
import { Versions } from "./Versions";

/** The tabs, by `?view=`. */
const VIEWS = ["general", "chain", "versions", "details"] as const;
type View = (typeof VIEWS)[number];

type Action = "renew" | "revoke" | "export" | "deploy" | "add-key" | "add-csr";

/** The side panel's width, open. */
const PANEL_WIDTH = 480;

const TabIcon = ({ title, icon }: { title: string; icon: ReactNode }) => (
  <Tooltip title={title} placement="left">
    <span aria-label={title}>{icon}</span>
  </Tooltip>
);

/**
 * One certificate, from `?id=`: what it is and what to do with it across
 * the top, its counts, then General (its lifeline, what it says and how
 * it is kept), Chain (its chain, where it is used, its revocation, key and
 * CA's rules), Versions (each version, its story,
 * what happens next) and Details (decoded, its PEM and files, commands to
 * check it); in a side panel, its activity, its PEM, and its fingerprints
 * and extensions.
 */
export function CertificatePage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.get("id") ?? undefined;
  const view: View = VIEWS.find((v) => v === params.get("view")) ?? "general";
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const { isAdmin } = useCurrentUser();
  const { data: certificate, error } = useCertificate(id);
  const { data: lineages } = useCertificateLineages();
  const { data: issuers } = useIssuers();
  const { data: dashboard } = useDashboard();
  const { data: allTargets } = useDeployTargets();
  const [action, setAction] = useState<Action>();
  const [now] = useState(() => Date.now());

  const place = useMemo(
    () => (id && lineages ? lineageOf(id, lineages.lineages) : undefined),
    [id, lineages],
  );
  const lineage = place?.lineage;
  const targets = useMemo(
    () => (id ? targetsOf(lineage, id, allTargets ?? []) : []),
    [id, lineage, allTargets],
  );
  const subjects = useMemo(
    () =>
      id
        ? [
            ...(lineage?.versions.map((v) => v.certificateId) ?? [id]).map(
              (v) => ({ type: "certificate", id: v }),
            ),
            ...targets.map((t) => ({ type: "deploy-target", id: t.id })),
          ]
        : undefined,
    [id, lineage, targets],
  );
  const { data: events } = useSubjectEvents(subjects);
  const authorities = useMemo(
    () => new Map((dashboard?.authorities ?? []).map((a) => [a.issuerId, a])),
    [dashboard],
  );

  const go = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const refresh = () =>
    mutate(
      (key) =>
        typeof key === "string" &&
        (key.startsWith("/certificates") ||
          key.startsWith("/certificate/") ||
          key.startsWith("/audit/events") ||
          key === KEYS.lineages),
    );

  if (!id || !certificate) {
    return (
      <div className={styles.page}>
        <div className={styles.padded}>
          <ErrorAlert
            error={id ? error : new Error("No certificate was named")}
            title="The certificate could not be read"
          />
          {id && !error && <Skeleton active />}
        </div>
      </div>
    );
  }

  const issuer = issuers?.find((i) => i.id === certificate.issuerId);
  const versions = lineage?.versions ?? [];
  const isCurrent = versions.length === 0 || versions[0].certificateId === id;
  const newest = versions[0];
  const valid = certificate.state === "valid";
  const expired = Date.parse(certificate.notAfter) <= now;
  const name = lineage?.name ?? certificate.subject;
  const fileName = (certificate.names.dns?.[0] ?? certificate.serial).replace(
    /^\*\./,
    "wildcard.",
  );
  const served = targets.filter(
    (t) => t.lastObservation?.servedCertificateId === id,
  );
  const stapled = served.filter((t) => t.lastObservation?.stapled).length;
  const authority = authorities.get(certificate.issuerId);
  const due = lineage?.renewalDueAt
    ? Date.parse(lineage.renewalDueAt)
    : undefined;
  const canKey = isAdmin && certificate.keyLocation === "signer";
  // XCA's certificates imported as a record gain their key, then their
  // CSR (ADR 0039); nothing else does.
  const completable =
    isAdmin &&
    valid &&
    certificate.enrollmentMode === "imported" &&
    !certificate.hasCsr;
  const canAddKey = completable && certificate.keyLocation === "subscriber";
  const canAddCsr = completable && certificate.keyLocation === "signer";
  const actions: {
    key: Action;
    label: string;
    icon: React.ReactNode;
    danger?: boolean;
  }[] = [
    ...(valid && !expired
      ? [{ key: "renew" as const, label: "Renew", icon: <ReloadOutlined /> }]
      : []),
    ...(valid && !expired && canKey
      ? [
          {
            key: "deploy" as const,
            label: "Deploy…",
            icon: <DeploymentUnitOutlined />,
          },
        ]
      : []),
    ...(canKey
      ? [
          {
            key: "export" as const,
            label: "Export the key",
            icon: <KeyOutlined />,
          },
        ]
      : []),
    ...(canAddKey
      ? [
          {
            key: "add-key" as const,
            label: "Add its key",
            icon: <ImportOutlined />,
          },
        ]
      : []),
    ...(canAddCsr
      ? [
          {
            key: "add-csr" as const,
            label: "Add its CSR",
            icon: <FileAddOutlined />,
          },
        ]
      : []),
    ...(valid && !expired
      ? [
          {
            key: "revoke" as const,
            label: "Revoke…",
            icon: <StopOutlined />,
            danger: true,
          },
        ]
      : []),
  ];

  const stateTag = !valid ? (
    <Tag color="red">Revoked</Tag>
  ) : expired ? (
    <Tag>Expired</Tag>
  ) : (
    <Tag color="green">Valid</Tag>
  );

  return (
    <SideTabPanel
      panelId="harpocrates.certificate"
      width={PANEL_WIDTH}
      className={styles.page}
      tabs={[
        {
          key: "activity",
          label: <TabIcon title="Activity" icon={<HistoryOutlined />} />,
          children: (
            <Activity
              events={events ?? []}
              lineage={lineage}
              onMore={() => go({ view: "versions" })}
            />
          ),
        },
        {
          key: "pem",
          label: (
            <TabIcon title="Certificate (PEM)" icon={<FileTextOutlined />} />
          ),
          children: (
            <CertificatePem pem={certificate.certificate} fileName={fileName} />
          ),
        },
        {
          key: "extensions",
          label: (
            <TabIcon
              title="Fingerprints and extensions"
              icon={<ProfileOutlined />}
            />
          ),
          children: (
            <CertificateDetails
              pem={certificate.certificate}
              nameConstraints={[]}
            />
          ),
        },
      ]}
    >
      {messageHolder}
      <Flex
        justify="space-between"
        align="flex-start"
        wrap
        gap="middle"
        className={styles.header}
      >
        <Flex gap="middle" align="center" className={styles.shrink}>
          <span className={styles.icon} aria-hidden>
            <FileProtectOutlined />
          </span>
          <div className={styles.shrink}>
            <Typography.Text type="secondary" className={styles.small}>
              <Link href="/certificates">Certificates</Link>
              {place && ` / version ${place.number} of ${versions.length}`}
            </Typography.Text>
            <div className={styles.headerTitle}>
              <Typography.Title level={3} className={styles.title}>
                {name}
              </Typography.Title>
              {stateTag}
              {lineage?.health && isCurrent && (
                <Tag color={HEALTH[lineage.health].color}>
                  {HEALTH[lineage.health].label}
                </Tag>
              )}
              {!isCurrent && newest && (
                <Link href={`/certificate?id=${newest.certificateId}`}>
                  <Tag color="gold">Replaced: see v{versions.length}</Tag>
                </Link>
              )}
            </div>
            <Typography.Text type="secondary" className={styles.small}>
              Issued by{" "}
              {issuer ? (
                <Link href={`/ca?id=${issuer.id}`}>{shortCaName(issuer)}</Link>
              ) : (
                certificate.issuerId
              )}
              {certificate.profileId && (
                <>
                  {" "}
                  under{" "}
                  <Link href={`/profiles?id=${certificate.profileId}`}>
                    {certificate.profileId}
                  </Link>
                </>
              )}
              {lineage && ` · renewed by ${RENEWED_BY[lineage.renewer]}`}
            </Typography.Text>
          </div>
        </Flex>
        <Flex gap="small" wrap>
          <Dropdown
            menu={{
              items: [
                { key: "crt", label: "The certificate (.pem)" },
                { key: "chain", label: "With its chain (.pem)" },
              ],
              onClick: ({ key }) =>
                saveFile(
                  `${fileName}.${key}.pem`,
                  key === "crt"
                    ? certificate.certificate
                    : [certificate.certificate, ...certificate.chain].join(""),
                  "application/x-pem-file",
                ),
            }}
          >
            <Button icon={<DownloadOutlined />}>Download</Button>
          </Dropdown>
          {actions.map((a) => (
            <Button
              key={a.key}
              icon={a.icon}
              danger={a.danger}
              onClick={() => setAction(a.key)}
            >
              {a.label}
            </Button>
          ))}
        </Flex>
      </Flex>
      <CountStrip>
        <Count
          title="Expires"
          value={expired ? "Expired" : timeUntil(certificate.notAfter, now)}
          note={formatDateTime(certificate.notAfter)}
        />
        <Count
          title="Renewal"
          value={
            !isCurrent
              ? "Replaced"
              : !valid || expired || due === undefined
                ? "—"
                : due <= now
                  ? "Due"
                  : timeUntil(new Date(due).toISOString(), now)
          }
          note={
            !isCurrent
              ? `By v${versions.length}, ${formatDate(newest?.issuedAt)}`
              : lineage
                ? `${lineage.renewal === "automatic" ? "Automatic" : "By hand"}${due ? `, due ${formatDate(new Date(due).toISOString())}` : ""}`
                : undefined
          }
        />
        <Count
          title="Versions"
          value={versions.length || 1}
          note={
            versions.length
              ? `Since ${formatDate(versions[versions.length - 1].issuedAt)}`
              : undefined
          }
        />
        <Count
          title="Served"
          value={targets.length ? `${served.length} of ${targets.length}` : "—"}
          note={
            targets.length
              ? served.length
                ? `This version, ${stapled} stapled`
                : "None serves this version"
              : "Not deployed by Harpocrates"
          }
        />
        <Count
          title="Revocation"
          value={valid ? "Good" : "Revoked"}
          note={
            authority?.nextUpdate
              ? `CRL ${authority.number}, next ${Date.parse(authority.nextUpdate) <= now ? "lapsed" : `in ${timeUntil(authority.nextUpdate, now)}`}`
              : "Its CA has no list here"
          }
        />
      </CountStrip>
      <Tabs
        className={styles.tabs}
        activeKey={view}
        onChange={(key) => go({ view: key })}
        items={[
          {
            key: "general",
            label: "General",
            children: (
              <Overview
                certificate={certificate}
                lineage={lineage}
                targets={targets}
                now={now}
              />
            ),
          },
          {
            key: "chain",
            label: "Chain",
            children: (
              <Chain
                certificate={certificate}
                lineage={lineage}
                issuers={issuers ?? []}
                authorities={authorities}
                targets={targets}
                now={now}
                canDeploy={actions.some((a) => a.key === "deploy")}
                onDeploy={() => setAction("deploy")}
              />
            ),
          },
          {
            key: "versions",
            label: "Versions",
            children: (
              <Versions
                certificate={certificate}
                lineage={lineage}
                events={events ?? []}
                now={now}
              />
            ),
          },
          {
            key: "details",
            label: "Details",
            children: (
              <Details
                certificate={certificate}
                issuer={issuer}
                targets={targets}
                fileName={fileName}
              />
            ),
          },
        ]}
      />
      <Modal
        open={Boolean(action)}
        title={
          action === "renew"
            ? `Renew ${name}`
            : action === "revoke"
              ? `Revoke ${name}`
              : action === "export"
                ? "Export its key"
                : action === "add-key"
                  ? "Add its key"
                  : action === "add-csr"
                    ? "Add its CSR"
                    : `Deploy ${name}`
        }
        footer={null}
        width={640}
        destroyOnHidden
        onCancel={() => setAction(undefined)}
      >
        {action === "renew" && (
          <RenewForm
            certificate={certificate}
            onRenewed={async (renewal) => {
              await refresh();
              setAction(undefined);
              void messages.success("Renewed");
              router.push(`/certificate?id=${renewal.id}`);
            }}
          />
        )}
        {action === "revoke" && (
          <RevokeForm
            certificate={certificate}
            onRevoked={async (revoked) => {
              await refresh();
              setAction(undefined);
              void messages.success(
                revoked.length > 1
                  ? `Revoked, with ${revoked.length - 1} other certificates for its key`
                  : "Revoked",
              );
            }}
          />
        )}
        {action === "export" && (
          <KeyExportForm certificateId={certificate.id} />
        )}
        {action === "add-key" && (
          <AddKeyForm
            certificateId={certificate.id}
            onAdded={async (added) => {
              await refresh();
              setAction(undefined);
              void messages.success(
                added.hasCsr
                  ? "Its key is escrowed and its CSR kept"
                  : "Its key is escrowed",
              );
            }}
          />
        )}
        {action === "add-csr" && (
          <AddCsrForm
            certificateId={certificate.id}
            onAdded={async () => {
              await refresh();
              setAction(undefined);
              void messages.success("Its CSR is kept");
            }}
          />
        )}
        {action === "deploy" && (
          <DeployTargetForm
            certificate={certificate}
            onCreated={(target) =>
              router.push(`/deploy-targets?id=${target.id}`)
            }
          />
        )}
      </Modal>
    </SideTabPanel>
  );
}
