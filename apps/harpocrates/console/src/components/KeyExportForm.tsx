"use client";

import { Button, Form, Input, Select } from "antd";
import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { KeyExportFormat } from "@/lib/api/types";
import { fromBase64, saveFile } from "@/lib/download";
import { ErrorAlert } from "./ErrorAlert";
import { PassphraseFields } from "./PassphraseFields";

const FORMATS: { value: KeyExportFormat; label: string }[] = [
  { value: "pkcs12", label: "PKCS#12, with the chain" },
  { value: "pem", label: "PEM (encrypted PKCS#8)" },
  { value: "pkcs12-legacy", label: "Legacy PKCS#12 (SHA-1, 3DES, no chain)" },
];

interface Values {
  format: KeyExportFormat;
  passphrase: string;
  reason: string;
}

/**
 * Exports a generated key (ADR 0020, escrow): an admin, a reason for the
 * audit log, a recent sign-in. A key that is not escrowed exports once
 * and is destroyed.
 */
export function KeyExportForm({
  certificateId,
  exportOnce,
  onExported,
}: {
  certificateId: string;
  exportOnce?: boolean;
  onExported?: () => void;
}) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const exportKey = async ({ format, passphrase, reason }: Values) => {
    setBusy(true);
    try {
      const file = unwrap(
        await apiClient.POST("/v1/certificate/{certificateId}/key-export", {
          params: { path: { certificateId } },
          body: { format, passphrase, reason },
        }),
      );
      saveFile(file.fileName, fromBase64(file.data));
      setError(undefined);
      onExported?.();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Form<Values>
      layout="vertical"
      initialValues={{ format: "pkcs12" }}
      onFinish={exportKey}
    >
      <Form.Item name="format" label="Format">
        <Select options={FORMATS} />
      </Form.Item>
      <PassphraseFields label="File passphrase" />
      <Form.Item
        name="reason"
        label="Reason"
        rules={[{ required: true, message: "For the audit log" }]}
      >
        <Input placeholder="Installing on the new laptop" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={busy}>
        {exportOnce ? "Export it, once" : "Export the key"}
      </Button>
      <ErrorAlert error={error} />
    </Form>
  );
}
