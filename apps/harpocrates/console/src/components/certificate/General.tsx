import { CheckOutlined, CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Flex, Table, Tag, Tooltip, Typography } from "antd";
import Link from "next/link";
import type {
  CertificateLineage,
  DashboardAuthority,
  DeployTarget,
  FullCertificate,
  Issuer,
} from "@/lib/api/types";
import {
  chainOf,
  checksOf,
  revocationOf,
  servedOf,
} from "@/lib/certificatePage";
import { timeSince } from "@/lib/dashboard";
import { formatDate, formatDateTime, REVOCATION_REASONS } from "@/lib/labels";
import { shortCaName } from "@/lib/tree";
import { PrincipalName } from "../PrincipalName";
import { tierStyle, useTierColors } from "../roots/shared";
import styles from "./Certificate.module.css";

const year = (iso?: string) => (iso ? new Date(iso).getFullYear() : "?");

/** A check's mark, never colour alone. */
const Mark = ({ ok }: { ok: boolean }) =>
  ok ? (
    <CheckOutlined className={styles.ok} aria-label="Meets it" />
  ) : (
    <CloseOutlined className={styles.bad} aria-label="Does not" />
  );

/**
 * The General tab: the chain a client builds, from its root to this
 * certificate, each CA's revocation; where it is deployed and what each
 * endpoint serves; its revocation, its key, and the rules of its CA it
 * meets.
 */
export function General({
  certificate,
  lineage,
  issuers,
  authorities,
  targets,
  now,
  canDeploy,
  onDeploy,
}: {
  certificate: FullCertificate;
  lineage?: CertificateLineage;
  issuers: Issuer[];
  authorities: Map<string, DashboardAuthority>;
  targets: DeployTarget[];
  now: number;
  canDeploy: boolean;
  onDeploy: () => void;
}) {
  const tiers = useTierColors();
  const chain = chainOf(certificate.issuerId, issuers);
  const issuer = chain[chain.length - 1];
  const checks = checksOf(certificate, issuer);
  const stale = targets.filter(
    (t) =>
      t.lastObservation &&
      t.lastObservation.servedCertificateId !== certificate.id &&
      t.lastObservation.result !== "current",
  );
  const valid = certificate.state === "valid";
  return (
    <>
      <div className={styles.section}>
        <Typography.Title level={5} className={styles.boxTitle}>
          The chain a client builds
        </Typography.Title>
        <Typography.Text type="secondary" className={styles.small}>
          Trusted wherever its root is installed
          {chain[0] ? (
            <>
              :{" "}
              <Link href={`/ca?id=${chain[0].id}`}>
                {shortCaName(chain[0])}
              </Link>
            </>
          ) : null}
        </Typography.Text>
      </div>
      <div className={styles.chain} aria-label="The chain">
        {chain.map((ca) => {
          const revocation = revocationOf(authorities.get(ca.id), now);
          return (
            <Flex key={ca.id} className={styles.grow} gap={4}>
              <div className={styles.node} style={tierStyle(tiers[ca.tier])}>
                <Link href={`/ca?id=${ca.id}`}>
                  <Typography.Text strong ellipsis>
                    {shortCaName(ca)}
                  </Typography.Text>
                </Link>
                <br />
                <Typography.Text type="secondary" className={styles.small}>
                  {ca.tier} · {ca.offline ? "offline" : "online"}
                </Typography.Text>
                <br />
                <Typography.Text className={styles.small}>
                  {year(ca.notBefore)} → {year(ca.notAfter)}
                </Typography.Text>
                <br />
                <Typography.Text
                  className={`${styles.small} ${revocation.ok ? styles.ok : styles.bad}`}
                >
                  <Mark ok={revocation.ok} /> {revocation.text}
                </Typography.Text>
              </div>
              <div className={styles.arrow} aria-hidden>
                →
              </div>
            </Flex>
          );
        })}
        <div
          className={`${styles.node} ${styles.nodeOn}`}
          style={tierStyle(valid ? "#0ca30c" : "#d03b3b")}
        >
          <Typography.Text strong ellipsis>
            {lineage?.name ?? certificate.subject}
          </Typography.Text>
          <br />
          <Typography.Text type="secondary" className={styles.small}>
            this certificate
          </Typography.Text>
          <br />
          <Typography.Text className={styles.small}>
            {formatDate(certificate.notBefore)} →{" "}
            {formatDate(certificate.notAfter)}
          </Typography.Text>
          <br />
          <Typography.Text
            className={`${styles.small} ${valid ? styles.ok : styles.bad}`}
          >
            <Mark ok={valid} />{" "}
            {valid
              ? "Not revoked"
              : `Revoked ${formatDate(certificate.revocation?.revokedAt)}`}
          </Typography.Text>
        </div>
      </div>

      <div className={styles.section}>
        <Typography.Title level={5} className={styles.boxTitle}>
          Where it is used
        </Typography.Title>
        {canDeploy && (
          <Button icon={<PlusOutlined />} onClick={onDeploy}>
            Deploy to…
          </Button>
        )}
      </div>
      <Table<DeployTarget>
        rowKey="id"
        size="middle"
        pagination={false}
        dataSource={targets}
        className={styles.flushTable}
        scroll={{ x: 800 }}
        locale={{
          emptyText:
            "Not deployed by Harpocrates: its holder installs it, or its renewer does",
        }}
        columns={[
          {
            title: "Target",
            key: "target",
            render: (_, t) => (
              <Link href={`/deploy-targets?id=${t.id}`}>{t.name}</Link>
            ),
          },
          {
            title: "Endpoint",
            key: "endpoint",
            render: (_, t) => (
              <Typography.Text className={`${styles.mono} ${styles.small}`}>
                {t.endpoint}
              </Typography.Text>
            ),
          },
          {
            title: "Serves",
            key: "serves",
            render: (_, t) => {
              const served = servedOf(t, certificate, lineage);
              return (
                <Tooltip title={t.lastObservation?.error}>
                  <Tag color={served.color}>{served.label}</Tag>
                </Tooltip>
              );
            },
          },
          {
            title: "OCSP",
            key: "ocsp",
            render: (_, t) =>
              t.lastObservation?.stapled === undefined
                ? "—"
                : t.lastObservation.stapled
                  ? "Stapled"
                  : "Not stapled",
          },
          {
            title: "Deployed",
            key: "deployed",
            render: (_, t) =>
              t.lastDeployment
                ? timeSince(t.lastDeployment.createdAt, now)
                : "—",
          },
          {
            title: "Checked",
            key: "checked",
            render: (_, t) =>
              t.lastObservation ? (
                <Tooltip title={formatDateTime(t.lastObservation.updatedAt)}>
                  {timeSince(t.lastObservation.updatedAt, now)}
                </Tooltip>
              ) : (
                "—"
              ),
          },
        ]}
      />
      {stale.map((t) => (
        <Alert
          key={t.id}
          type="warning"
          showIcon
          className={styles.alert}
          title={`${t.endpoint} does not serve this certificate`}
          description={
            t.lastObservation?.result === "unreachable"
              ? `It could not be reached: ${t.lastObservation.error ?? "no answer"}.`
              : `It serves ${t.lastObservation?.servedSubject ?? "another certificate"}${t.lastObservation?.servedNotAfter ? `, which expires ${formatDate(t.lastObservation.servedNotAfter)}` : ""}. Deploy it again, or check what the endpoint loads.`
          }
        />
      ))}

      <div className={styles.boxes}>
        <section className={styles.box}>
          <Typography.Title level={5} className={styles.boxTitle}>
            Revocation
          </Typography.Title>
          {certificate.revocation ? (
            <Typography.Text>
              Revoked {formatDateTime(certificate.revocation.revokedAt)} by{" "}
              <PrincipalName principal={certificate.revocation.principal} />:{" "}
              {REVOCATION_REASONS[certificate.revocation.reason].toLowerCase()}
              {certificate.revocation.comment
                ? ` (${certificate.revocation.comment})`
                : ""}
              . Its CA&apos;s lists and OCSP say so.
            </Typography.Text>
          ) : (
            <Typography.Text>
              Not revoked: its CA&apos;s list and OCSP say good.
            </Typography.Text>
          )}
          <Typography.Text type="secondary" className={styles.small}>
            Revoking it puts it in its CA&apos;s next list and OCSP at once.
          </Typography.Text>
        </section>
        <section className={styles.box}>
          <Typography.Title level={5} className={styles.boxTitle}>
            Its key
          </Typography.Title>
          <Typography.Text>
            {certificate.keyAlgorithm},{" "}
            {certificate.keyLocation === "signer"
              ? "kept in the signer: it can be exported, and deployed"
              : certificate.keyLocation === "subscriber"
                ? "made by its holder (a CSR): Harpocrates never held it"
                : "on offline media"}
            .
          </Typography.Text>
          <Typography.Text type="secondary" className={styles.small}>
            Made {formatDateTime(certificate.keyCreatedAt)}
          </Typography.Text>
        </section>
        <section className={styles.box}>
          <Typography.Title level={5} className={styles.boxTitle}>
            Its CA&apos;s rules it meets
          </Typography.Title>
          {checks.length === 0 ? (
            <Typography.Text type="secondary">
              Its CA is not in Harpocrates.
            </Typography.Text>
          ) : (
            <Flex vertical gap={4}>
              {checks.map((check) => (
                <Typography.Text key={check.text}>
                  <Mark ok={check.ok} /> {check.text}
                </Typography.Text>
              ))}
            </Flex>
          )}
        </section>
      </div>
    </>
  );
}
