"use client";

import {
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Flex,
  Tag,
  Typography,
} from "antd";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
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

type CopyStatus = "idle" | "copied" | "failed";

/** How long a copy's outcome shows before the action reads Copy again. */
const COPY_STATUS_MS = 2000;

/**
 * Copying to the clipboard, its outcome held for a moment so the control
 * that did it can show it (rather than a message announcing it).
 */
const useCopy = (text: string) => {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    timer.current = setTimeout(() => setStatus("idle"), COPY_STATUS_MS);
  };
  return { status, copy };
};

/** A copy control's icon and words for its status. */
const COPY_LABELS: Record<CopyStatus, { icon: React.ReactNode; text: string }> =
  {
    idle: { icon: <CopyOutlined />, text: "Copy" },
    copied: { icon: <CheckOutlined />, text: "Copied" },
    failed: { icon: <CloseOutlined />, text: "Couldn't copy" },
  };

/**
 * A long hex value (a serial, a fingerprint, a key identifier) in a card
 * of its own, small enough to read whole. The card's action row is the
 * copy control, as antd's card actions are: the whole row is clickable,
 * and it says Copied (or that it couldn't) for a moment after.
 */
function HexCard({ value, label }: { value: string; label: string }) {
  const { status, copy } = useCopy(value);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void copy();
    }
  };
  return (
    <Card
      size="small"
      className={styles.hexCard}
      classNames={{ body: styles.hexBody, actions: styles.hexActions }}
      actions={[
        <span
          key="copy"
          role="button"
          tabIndex={0}
          aria-label={`Copy the ${label}`}
          aria-live="polite"
          className={`${styles.hexCopy} ${styles[status] ?? ""}`}
          onClick={() => void copy()}
          onKeyDown={onKeyDown}
        >
          {COPY_LABELS[status].icon} {COPY_LABELS[status].text}
        </span>,
      ]}
    >
      <span className={styles.hex}>{value}</span>
    </Card>
  );
}

/** A labelled hex value: its label above its card, left-aligned. */
function HexField({ label, value }: { label: string; value: string }) {
  return (
    <Flex vertical gap={4}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <HexCard value={value} label={label} />
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
            <HexCard key={value} value={value} label={extension.name} />
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
