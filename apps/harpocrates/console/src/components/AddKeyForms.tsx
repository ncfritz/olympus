"use client";

import { Button, Form, Input, Radio } from "antd";
import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { Certificate, KeyImportFormat } from "@/lib/api/types";
import { ErrorAlert } from "./ErrorAlert";
import { ImportKeyInput } from "./ImportKeyInput";
import { PemInput } from "./PemInput";

interface KeyValues {
  format: KeyImportFormat;
  data?: string;
  passphrase?: string;
  csr?: string;
}

/**
 * Gives a certificate imported as a record its key, escrowed in the
 * signer, and the CSR it was issued from if that is at hand (ADR 0039).
 * The key must be the certificate's, and the CSR signed by it.
 */
export function AddKeyForm({
  certificateId,
  onAdded,
}: {
  certificateId: string;
  onAdded: (certificate: Certificate) => void;
}) {
  const [form] = Form.useForm<KeyValues>();
  const format = Form.useWatch("format", form) ?? "pem";
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  const submit = async (values: KeyValues) => {
    setBusy(true);
    setError(undefined);
    try {
      const { certificate } = unwrap(
        await apiClient.POST("/v1/certificate/{certificateId}/key", {
          params: { path: { certificateId } },
          body: {
            key: {
              format: values.format,
              data: values.data!,
              passphrase: values.passphrase!,
            },
            csr: values.csr || undefined,
          },
        }),
      );
      onAdded(certificate);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Form<KeyValues>
      form={form}
      layout="vertical"
      initialValues={{ format: "pem" }}
      onFinish={submit}
    >
      <Form.Item name="format" label="Its key">
        <Radio.Group
          options={[
            { value: "pem", label: "Encrypted PKCS#8 (PEM)" },
            { value: "pkcs12", label: "PKCS#12 (.p12, .pfx)" },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="data"
        extra={
          format === "pkcs12"
            ? "XCA: Certificates → the certificate → Export, PKCS#12. Only its key is used; it goes to the signer, escrowed."
            : "XCA: Private keys → the key → Export, PKCS#8 encrypted. It goes to the signer, escrowed."
        }
        rules={[
          { required: true, message: "Bring the key" },
          ...(format === "pem"
            ? [
                {
                  pattern: /-----BEGIN ENCRYPTED PRIVATE KEY-----/,
                  message: "An encrypted PKCS#8 key",
                },
              ]
            : []),
        ]}
      >
        <ImportKeyInput format={format} />
      </Form.Item>
      <Form.Item
        name="passphrase"
        label="The key's password"
        extra="Used once to read it, never kept"
        rules={[{ required: true, message: "Required" }]}
      >
        <Input.Password autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="csr"
        label="Its CSR"
        extra="Optional. XCA: Certificate signing requests → Export, PEM. It must be signed by the key."
      >
        <PemInput kind="csr" rows={3} />
      </Form.Item>
      <ErrorAlert error={error} title="The key could not be added" />
      <Button type="primary" htmlType="submit" loading={busy}>
        Add its key
      </Button>
    </Form>
  );
}

/**
 * Keeps the CSR an imported certificate was issued from, once its key is
 * escrowed (ADR 0039): signed by that key.
 */
export function AddCsrForm({
  certificateId,
  onAdded,
}: {
  certificateId: string;
  onAdded: (certificate: Certificate) => void;
}) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  const submit = async (values: { csr?: string }) => {
    setBusy(true);
    setError(undefined);
    try {
      const { certificate } = unwrap(
        await apiClient.POST("/v1/certificate/{certificateId}/csr", {
          params: { path: { certificateId } },
          body: { csr: values.csr! },
        }),
      );
      onAdded(certificate);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Form layout="vertical" onFinish={submit}>
      <Form.Item
        name="csr"
        label="Its CSR"
        extra="XCA: Certificate signing requests → Export, PEM. It must be signed by the certificate's key."
        rules={[{ required: true, message: "Drop, choose or paste it" }]}
      >
        <PemInput kind="csr" rows={4} />
      </Form.Item>
      <ErrorAlert error={error} title="The CSR could not be added" />
      <Button type="primary" htmlType="submit" loading={busy}>
        Add its CSR
      </Button>
    </Form>
  );
}
