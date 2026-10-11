"use client";

import { Alert, Descriptions, Flex, Table, Tag, Typography } from "antd";
import useSWR from "swr";
import {
  type ExtensionDetail,
  NAME_CONSTRAINTS_OID,
  readCertificate,
} from "@/lib/certificateDetails";
import styles from "./IssuerPage.module.css";

/**
 * A certificate itself, read from its PEM: serial, fingerprints, key and
 * signature algorithms, every extension with whether it is critical, and
 * the PEM to copy.
 */
export function CertificateDetails({
  pem,
  nameConstraints,
}: {
  pem: string;
  /** The name constraints, as the service holds them: shown for the extension. */
  nameConstraints: string[];
}) {
  const { data: certificate, error } = useSWR(["certificate", pem], () =>
    readCertificate(pem),
  );
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        title="The certificate does not parse"
        description={String(error)}
      />
    );
  }
  if (!certificate) return null;
  const mono = (value: string) => <span className={styles.mono}>{value}</span>;

  return (
    <Flex vertical gap="large">
      <Descriptions
        column={1}
        size="small"
        classNames={{ label: styles.label }}
        items={[
          {
            key: "serial",
            label: "Serial",
            children: mono(certificate.serial),
          },
          {
            key: "sha256",
            label: "SHA-256",
            children: (
              <Typography.Text copyable={{ text: certificate.sha256 }}>
                {mono(certificate.sha256)}
              </Typography.Text>
            ),
          },
          { key: "sha1", label: "SHA-1", children: mono(certificate.sha1) },
          {
            key: "publicKey",
            label: "Public key",
            children: certificate.publicKey,
          },
          {
            key: "signature",
            label: "Signature",
            children: certificate.signatureAlgorithm,
          },
        ]}
      />
      <Table<ExtensionDetail>
        rowKey="oid"
        size="small"
        pagination={false}
        dataSource={certificate.extensions}
        columns={[
          {
            title: "Extension",
            key: "name",
            render: (_, extension) => (
              <Flex vertical>
                {extension.name}
                {extension.name !== extension.oid && (
                  <Typography.Text type="secondary">
                    {mono(extension.oid)}
                  </Typography.Text>
                )}
              </Flex>
            ),
          },
          {
            title: "Critical",
            dataIndex: "critical",
            render: (critical: boolean) =>
              critical ? <Tag color="orange">critical</Tag> : "—",
          },
          {
            title: "Value",
            key: "values",
            render: (_, extension) => (
              <Flex vertical>
                {(extension.oid === NAME_CONSTRAINTS_OID &&
                nameConstraints.length
                  ? nameConstraints
                  : extension.values
                ).map((value) => (
                  <span key={value} className={styles.mono}>
                    {value}
                  </span>
                ))}
              </Flex>
            ),
          },
        ]}
      />
      <Typography.Paragraph copyable={{ text: certificate.pem }}>
        <pre className={styles.pem}>{certificate.pem}</pre>
      </Typography.Paragraph>
    </Flex>
  );
}
