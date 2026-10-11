"use client";

import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
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
      <ul className={styles.values}>
        {values.map((value) => (
          <li key={value}>
            <Mono>{value}</Mono>
          </li>
        ))}
      </ul>
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
      <Descriptions
        column={1}
        size="small"
        classNames={{ label: styles.label }}
        items={[
          {
            key: "serial",
            label: "Serial",
            children: <Mono>{certificate.serial}</Mono>,
          },
          {
            key: "sha256",
            label: "SHA-256",
            children: (
              <Typography.Text copyable={{ text: certificate.sha256 }}>
                <Mono>{certificate.sha256}</Mono>
              </Typography.Text>
            ),
          },
          {
            key: "sha1",
            label: "SHA-1",
            children: <Mono>{certificate.sha1}</Mono>,
          },
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
