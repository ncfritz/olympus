"use client";

import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Flex,
  message,
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

/** A value in the theme's code font. */
const Mono = ({ children }: { children: string }) => (
  <span className={styles.mono}>{children}</span>
);

/** The extensions whose value is an identifier, shown as hex in a card. */
const KEY_IDENTIFIERS = new Set([
  "2.5.29.14", // subject key identifier
  "2.5.29.35", // authority key identifier
]);

type Copy = (text: string, what: string) => void;

/**
 * A long hex value (a serial, a fingerprint, a key identifier) in a card
 * of its own, small enough to read whole, with a copy action.
 */
function HexCard({
  value,
  label,
  copy,
}: {
  value: string;
  label: string;
  copy: Copy;
}) {
  return (
    <Card
      size="small"
      className={styles.hexCard}
      classNames={{ body: styles.hexBody, actions: styles.hexActions }}
      actions={[
        <Button
          key="copy"
          type="text"
          size="small"
          icon={<CopyOutlined />}
          className={styles.hexCopy}
          onClick={() => copy(value, label)}
        >
          Copy
        </Button>,
      ]}
    >
      <span className={styles.hex}>{value}</span>
    </Card>
  );
}

/** A labelled hex value: its label above its card, left-aligned. */
function HexField({
  label,
  value,
  copy,
}: {
  label: string;
  value: string;
  copy: Copy;
}) {
  return (
    <Flex vertical gap={4}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <HexCard value={value} label={label} copy={copy} />
    </Flex>
  );
}

/** One extension: its name, whether it is critical, its OID and values. */
function ExtensionSection({
  extension,
  nameConstraints,
  copy,
}: {
  extension: ExtensionDetail;
  nameConstraints: string[];
  copy: Copy;
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
            <HexCard
              key={value}
              value={value}
              label={extension.name}
              copy={copy}
            />
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
  const [messages, messageHolder] = message.useMessage();
  const copy: Copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      void messages.success(`Copied the ${what}`);
    } catch {
      void messages.error("The browser did not allow copying");
    }
  };
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
      {messageHolder}
      <Flex vertical gap="middle" className={styles.hexFields}>
        <HexField label="Serial" value={certificate.serial} copy={copy} />
        <HexField
          label="SHA-256 fingerprint"
          value={certificate.sha256}
          copy={copy}
        />
        <HexField
          label="SHA-1 fingerprint"
          value={certificate.sha1}
          copy={copy}
        />
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
            copy={copy}
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
  const [messages, messageHolder] = message.useMessage();
  const der = () => fromBase64(pem.replace(/-----[^-]+-----|\s/g, "").trim());
  return (
    <Flex vertical gap="middle">
      {messageHolder}
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
          icon={<CopyOutlined />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(pem);
              void messages.success("Copied the certificate");
            } catch {
              void messages.error("The browser did not allow copying");
            }
          }}
        >
          Copy
        </Button>
      </Flex>
      <PemBlock pem={pem} />
    </Flex>
  );
}
