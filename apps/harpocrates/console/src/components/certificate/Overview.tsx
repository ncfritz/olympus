import { Descriptions, Flex, Tag, Typography } from "antd";
import Link from "next/link";
import useSWR from "swr";
import type {
  CertificateLineage,
  DeployTarget,
  FullCertificate,
} from "@/lib/api/types";
import { readCertificate } from "@/lib/certificateDetails";
import { RENEWED_BY, servedOf } from "@/lib/certificatePage";
import { formatDate, formatDateTime } from "@/lib/labels";
import { Lifeline, useVersionColors } from "../certificates/Lifeline";
import styles from "./Certificate.module.css";

const DAY = 24 * 60 * 60 * 1000;

/** An extension's values, by its OID, from the decoded certificate. */
const valuesOf = (
  extensions: { oid: string; values: string[] }[] | undefined,
  oid: string,
): string[] => extensions?.find((e) => e.oid === oid)?.values ?? [];

/**
 * The General tab: its versions as a lifeline (its renewal point and
 * today marked), what it says (its subject, names, validity, usages,
 * serial and fingerprint, how it is revoked) and how it is kept (its
 * profile, renewer, next renewal, deploy targets, what they serve, its
 * key).
 */
export function Overview({
  certificate,
  lineage,
  targets,
  now,
}: {
  certificate: FullCertificate;
  lineage?: CertificateLineage;
  targets: DeployTarget[];
  now: number;
}) {
  const colors = useVersionColors();
  const { data: decoded } = useSWR(
    ["certificate", certificate.certificate],
    () => readCertificate(certificate.certificate),
  );
  const versions = lineage?.versions ?? [];
  const first = versions.length
    ? Date.parse(versions[versions.length - 1].notBefore)
    : Date.parse(certificate.notBefore);
  const last = Math.max(
    Date.parse(certificate.notAfter),
    ...versions.map((v) => Date.parse(v.notAfter)),
  );
  const start = Math.min(first, now) - 7 * DAY;
  const end = Math.max(last, now) + 14 * DAY;
  const days = Math.round(
    (Date.parse(certificate.notAfter) - Date.parse(certificate.notBefore)) /
      DAY,
  );
  const names = [
    ...(certificate.names.dns ?? []),
    ...(certificate.names.ip ?? []),
    ...(certificate.names.email ?? []),
    ...(certificate.names.uri ?? []),
    ...(certificate.names.upn ?? []),
  ];
  const usages = [
    ...valuesOf(decoded?.extensions, "2.5.29.15"),
    ...valuesOf(decoded?.extensions, "2.5.29.37"),
  ];
  const crl = valuesOf(decoded?.extensions, "2.5.29.31").length > 0;
  const aia = valuesOf(decoded?.extensions, "1.3.6.1.5.5.7.1.1");
  const ocsp = aia.some((v) => /ocsp/i.test(v));
  const mustStaple = decoded?.extensions.some(
    (e) => e.oid === "1.3.6.1.5.5.7.1.24",
  );
  const due = lineage?.renewalDueAt;

  return (
    <>
      <section className={`${styles.box} ${styles.lifelineBox}`}>
        <Flex justify="space-between" align="center" gap="small" wrap>
          <Typography.Title level={5} className={styles.boxTitle}>
            Its lifeline
          </Typography.Title>
          <Flex
            gap="middle"
            wrap
            className={`${styles.legend} ${styles.small}`}
          >
            {(["current", "replaced", "revoked"] as const).map((kind) => (
              <span key={kind} className={styles.legendItem}>
                <svg width={10} height={10} aria-hidden>
                  <rect width={10} height={10} rx={2} fill={colors[kind]} />
                </svg>
                {kind === "current"
                  ? "Current"
                  : kind === "replaced"
                    ? "Replaced"
                    : "Revoked"}
              </span>
            ))}
            <span className={styles.legendItem}>
              <span className={styles.dueSwatch} />
              Renewal due
            </span>
          </Flex>
        </Flex>
        {lineage ? (
          <>
            <Lifeline
              lineage={lineage}
              start={start}
              end={end}
              now={now}
              due
              tall
            />
            <Flex justify="space-between" className={styles.small}>
              <Typography.Text type="secondary">
                {formatDate(new Date(start).toISOString())}
              </Typography.Text>
              <Typography.Text type="secondary">
                {versions.length} version{versions.length === 1 ? "" : "s"}
                {due ? `; renewal due ${formatDate(due)}` : ""}
              </Typography.Text>
              <Typography.Text type="secondary">
                {formatDate(new Date(end).toISOString())}
              </Typography.Text>
            </Flex>
          </>
        ) : (
          <Typography.Text type="secondary">
            Its versions could not be read.
          </Typography.Text>
        )}
      </section>
      <div className={styles.split}>
        <section className={styles.box}>
          <Typography.Title level={5} className={styles.boxTitle}>
            What it says
          </Typography.Title>
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: "subject",
                label: "Subject",
                children: (
                  <Typography.Text className={styles.mono}>
                    {certificate.subject}
                  </Typography.Text>
                ),
              },
              {
                key: "names",
                label: "Names",
                children: names.length ? (
                  <Flex gap={4} wrap>
                    {names.map((n) => (
                      <Tag key={n}>{n}</Tag>
                    ))}
                  </Flex>
                ) : (
                  "None"
                ),
              },
              {
                key: "valid",
                label: "Valid",
                children: `${formatDateTime(certificate.notBefore)} → ${formatDateTime(certificate.notAfter)} (${days} days)`,
              },
              {
                key: "usage",
                label: "Usage",
                children: usages.length ? usages.join(" · ") : "—",
              },
              {
                key: "serial",
                label: "Serial",
                children: (
                  <Typography.Text
                    className={`${styles.mono} ${styles.small}`}
                    copyable
                  >
                    {certificate.serial}
                  </Typography.Text>
                ),
              },
              {
                key: "sha256",
                label: "SHA-256",
                children: decoded ? (
                  <Typography.Text
                    className={`${styles.mono} ${styles.small}`}
                    copyable={{ text: decoded.sha256 }}
                    ellipsis={{ tooltip: decoded.sha256 }}
                  >
                    {decoded.sha256}
                  </Typography.Text>
                ) : (
                  "…"
                ),
              },
              {
                key: "revocation",
                label: "Revocation",
                children:
                  [
                    crl && "CRL",
                    ocsp && `OCSP${mustStaple ? " (must-staple)" : ""}`,
                  ]
                    .filter(Boolean)
                    .join(" and ") || "Neither a CRL nor OCSP named",
              },
            ]}
          />
        </section>
        <section className={styles.box}>
          <Typography.Title level={5} className={styles.boxTitle}>
            How it is kept
          </Typography.Title>
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: "profile",
                label: "Profile",
                children: certificate.profileId ? (
                  <Link href={`/profiles?id=${certificate.profileId}`}>
                    {certificate.profileId}
                  </Link>
                ) : (
                  "None: imported, or issued before profiles"
                ),
              },
              {
                key: "renewer",
                label: "Renewed by",
                children: lineage
                  ? `${RENEWED_BY[lineage.renewer]} (${lineage.renewal === "automatic" ? "automatic" : "by hand"})`
                  : "—",
              },
              {
                key: "next",
                label: "Next renewal",
                children:
                  certificate.state !== "valid"
                    ? "None: it is revoked"
                    : lineage && versions[0]?.certificateId !== certificate.id
                      ? "None: a newer version replaced it"
                      : due
                        ? `Due ${formatDate(due)}`
                        : "—",
              },
              {
                key: "targets",
                label: "Deployed to",
                children: targets.length ? (
                  <Flex gap="small" wrap>
                    {targets.map((t) => (
                      <Link key={t.id} href={`/deploy-targets?id=${t.id}`}>
                        {t.name}
                      </Link>
                    ))}
                  </Flex>
                ) : (
                  "No deploy target: its holder installs it"
                ),
              },
              ...(targets.length
                ? [
                    {
                      key: "served",
                      label: "Served at",
                      children: (
                        <Flex vertical gap={4}>
                          {targets.map((t) => {
                            const served = servedOf(t, certificate, lineage);
                            return (
                              <Flex key={t.id} gap="small" align="center" wrap>
                                <Typography.Text
                                  className={`${styles.mono} ${styles.small}`}
                                >
                                  {t.endpoint}
                                </Typography.Text>
                                <Tag color={served.color}>{served.label}</Tag>
                              </Flex>
                            );
                          })}
                        </Flex>
                      ),
                    },
                  ]
                : []),
              {
                key: "key",
                label: "Key",
                children: `${certificate.keyAlgorithm}, ${
                  certificate.keyLocation === "signer"
                    ? "kept in the signer"
                    : certificate.keyLocation === "subscriber"
                      ? "its holder's alone (a CSR)"
                      : "on offline media"
                }`,
              },
            ]}
          />
        </section>
      </div>
    </>
  );
}
