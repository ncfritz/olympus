"use client";

import { InboxOutlined } from "@ant-design/icons";
import { Flex, Input, Typography, Upload } from "antd";
import { useState } from "react";
import { ACCEPT, type PemKind, readFile, summarise } from "@/lib/pem";
import styles from "./PemInput.module.css";

const WHAT: Record<PemKind, string> = {
  certificate: "the certificate",
  certificates: "the certificates",
  csr: "the CSR",
  key: "the key",
  crl: "the revocation list",
  pkcs12: "the .p12 file",
};

const PLACEHOLDERS: Record<Exclude<PemKind, "pkcs12">, string> = {
  certificate: "-----BEGIN CERTIFICATE-----",
  certificates: "-----BEGIN CERTIFICATE-----\n…\n-----BEGIN CERTIFICATE-----",
  csr: "-----BEGIN CERTIFICATE REQUEST-----",
  key: "-----BEGIN ENCRYPTED PRIVATE KEY-----",
  crl: "-----BEGIN X509 CRL-----",
};

export interface PemInputProps {
  kind: PemKind;
  value?: string;
  onChange?: (value: string | undefined) => void;
  /** Rows of the text area beneath the drop zone. */
  rows?: number;
}

/**
 * A certificate, CSR, key or list: dropped on the zone, chosen from it,
 * or pasted beneath it; read in the browser (DER is wrapped as PEM) and
 * said in a line, so a wrong file shows before it is sent. Several
 * certificates may be dropped at once where several are taken. A key
 * goes to the service in the request it is for, and nowhere else.
 */
export function PemInput({ kind, value, onChange, rows = 5 }: PemInputProps) {
  const [names, setNames] = useState<string[]>([]);
  const multiple = kind === "certificates";
  const summary = value ? summarise(value, kind) : undefined;

  return (
    <Flex vertical gap="small">
      <Upload.Dragger
        accept={ACCEPT[kind]}
        multiple={multiple}
        showUploadList={false}
        className={styles.zone}
        beforeUpload={async (file, files) => {
          // Several files come one call each: read them all on the first.
          if (file !== files[0]) return false;
          const read = await Promise.all(files.map((f) => readFile(f, kind)));
          setNames(files.map((f) => f.name));
          onChange?.(multiple ? read.join("\n") : read[0]);
          return false;
        }}
      >
        <Flex gap="middle" align="center" justify="center">
          <InboxOutlined className={styles.icon} />
          <Flex vertical align="flex-start">
            <Typography.Text>
              Drop {WHAT[kind]} here, or click to choose
              {multiple ? " (several at once)" : ""}
            </Typography.Text>
            <Typography.Text type="secondary" className={styles.small}>
              {ACCEPT[kind].split(",").join(" ")}
              {kind === "pkcs12" ? "" : ", PEM or DER; or paste it below"}
            </Typography.Text>
          </Flex>
        </Flex>
      </Upload.Dragger>
      {kind !== "pkcs12" && (
        <Input.TextArea
          rows={rows}
          spellCheck={false}
          className={styles.pem}
          placeholder={PLACEHOLDERS[kind]}
          value={value}
          onChange={(event) => {
            setNames([]);
            onChange?.(event.target.value || undefined);
          }}
        />
      )}
      {summary && (
        <Flex vertical>
          {names.length > 0 && (
            <Typography.Text type="secondary" className={styles.small}>
              Read {names.join(", ")}
            </Typography.Text>
          )}
          {summary.problem ? (
            <Typography.Text type="danger">{summary.problem}</Typography.Text>
          ) : (
            summary.lines.map((line, i) => (
              <Typography.Text key={i} className={styles.small}>
                {line}
              </Typography.Text>
            ))
          )}
        </Flex>
      )}
    </Flex>
  );
}
