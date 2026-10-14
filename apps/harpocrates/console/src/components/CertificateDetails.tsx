"use client";

import { DownloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Descriptions,
  Divider,
  Flex,
  Tag,
  Typography,
} from "antd";
import useSWR from "swr";
import {
  type ExtensionDetail,
  NAME_CONSTRAINTS_OID,
  readCertificate,
} from "@/lib/certificateDetails";
import { fromBase64, saveFile } from "@/lib/download";
import styles from "./CertificateDetails.module.css";
import { COPY_LABELS, useCopy, ValueCard } from "./ValueCard";

/** A value in the theme's code font. */
const Mono = ({ children }: { children: string }) => (
  <span className={styles.mono}>{children}</span>
);

/** The extensions whose value is an identifier, shown as hex in a card. */
const KEY_IDENTIFIERS = new Set([
  "2.5.29.14", // subject key identifier
  "2.5.29.35", // authority key identifier
]);

/** A labelled hex value: its label above its card, left-aligned. */
function HexField({ label, value }: { label: string; value: string }) {
  return (
    <Flex vertical gap={4}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <ValueCard value={value} label={label} />
    </Flex>
  );
}

/** One extension: its name, whether it is critical, its OID and values. */
function ExtensionSection({
  extension,
  nameConstraints,
}: {
  extension: ExtensionDetail;
  nameConstraints: string[];
}) {
  const values =
    extension.oid === NAME_CONSTRAINTS_OID && nameConstraints.length
      ? nameConstraints
      : extension.values;
  return (
    <section className={styles.extension}>
      <Flex justify="space-between" align="baseline" gap="small">
        <Typography.Title level={5} className={styles.extensionName}>
          {extension.name}
        </Typography.Title>
        {extension.critical && <Tag color="orange">critical</Tag>}
      </Flex>
      {extension.name !== extension.oid && (
        <Typography.Text type="secondary" className={styles.mono}>
          {extension.oid}
        </Typography.Text>
      )}
      {KEY_IDENTIFIERS.has(extension.oid) ? (
        <Flex vertical gap={4} className={styles.identifiers}>
          {values.map((value) => (
            <ValueCard key={value} value={value} label={extension.name} />
          ))}
        </Flex>
      ) : (
        <ul className={styles.values}>
          {values.map((value) => (
            <li key={value}>
              <Mono>{value}</Mono>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * A certificate itself, read from its PEM: serial, fingerprints, key and
 * signature algorithms, then each extension in a section of its own.
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

  return (
    <Flex vertical>
      <Flex vertical gap="middle" className={styles.hexFields}>
        <HexField label="Serial" value={certificate.serial} />
        <HexField label="SHA-256 fingerprint" value={certificate.sha256} />
        <HexField label="SHA-1 fingerprint" value={certificate.sha1} />
      </Flex>
      <Descriptions
        column={1}
        size="small"
        classNames={{ label: styles.label }}
        items={[
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
      <Divider titlePlacement="start">Extensions</Divider>
      <Flex vertical gap="middle">
        {certificate.extensions.map((extension) => (
          <ExtensionSection
            key={extension.oid}
            extension={extension}
            nameConstraints={nameConstraints}
          />
        ))}
      </Flex>
    </Flex>
  );
}

/** PEM text, to read. */
export function PemBlock({ pem }: { pem: string }) {
  return <pre className={styles.pem}>{pem}</pre>;
}

/** A certificate's PEM, to download as PEM or DER, or copy. */
export function CertificatePem({
  pem,
  fileName,
}: {
  pem: string;
  /** The files' name, without its extension. */
  fileName: string;
}) {
  const { status, copy } = useCopy(pem);
  const der = () => fromBase64(pem.replace(/-----[^-]+-----|\s/g, "").trim());
  return (
    <Flex vertical gap="middle">
      <Flex gap="small" wrap>
        <Button
          icon={<DownloadOutlined />}
          onClick={() =>
            saveFile(`${fileName}.crt.pem`, pem, "application/x-pem-file")
          }
        >
          PEM
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={() =>
            saveFile(`${fileName}.crt.der`, der(), "application/pkix-cert")
          }
        >
          DER
        </Button>
        <Button
          icon={COPY_LABELS[status].icon}
          className={styles[status] ?? ""}
          aria-live="polite"
          onClick={() => void copy()}
        >
          {COPY_LABELS[status].text}
        </Button>
      </Flex>
      <PemBlock pem={pem} />
    </Flex>
  );
}
