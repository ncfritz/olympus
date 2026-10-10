"use client";

import { Alert, Button, Flex, Form, Input, Select } from "antd";
import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { Certificate, RevocationReason } from "@/lib/api/types";
import { ErrorAlert } from "./ErrorAlert";

const REASONS: { value: RevocationReason; label: string }[] = [
  { value: "superseded", label: "Superseded: replaced by another" },
  {
    value: "cessationOfOperation",
    label: "Cessation of operation: no longer used",
  },
  {
    value: "affiliationChanged",
    label: "Affiliation changed: its subject moved on",
  },
  { value: "keyCompromise", label: "Key compromise: the key is out" },
  { value: "privilegeWithdrawn", label: "Privilege withdrawn" },
  { value: "unspecified", label: "Unspecified" },
];

interface Values {
  reason: RevocationReason;
  comment?: string;
}

/**
 * Revoking a certificate (ADR 0020): a reason, which the list carries,
 * and a comment for the audit log. keyCompromise also blocks the key for
 * good and revokes every certificate for it.
 */
export function RevokeForm({
  certificate,
  onRevoked,
}: {
  certificate: Certificate;
  onRevoked: (revoked: Certificate[]) => void;
}) {
  const [form] = Form.useForm<Values>();
  const reason = Form.useWatch("reason", form);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  const revoke = async (values: Values) => {
    setBusy(true);
    try {
      const { certificates } = unwrap(
        await apiClient.POST("/v1/certificate/{certificateId}/revoke", {
          params: { path: { certificateId: certificate.id } },
          body: { reason: values.reason, comment: values.comment || undefined },
        }),
      );
      setError(undefined);
      onRevoked(certificates);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Form<Values>
      form={form}
      layout="vertical"
      initialValues={{ reason: "superseded" }}
      onFinish={revoke}
    >
      <Form.Item name="reason" label="Reason">
        <Select options={REASONS} />
      </Form.Item>
      {reason === "keyCompromise" && (
        <Alert
          type="error"
          showIcon
          title="Every certificate for this key is revoked, and the key is blocked for good"
          description="An escrowed key is destroyed. Nothing can certify this key again."
        />
      )}
      <Form.Item name="comment" label="Comment" extra="For the audit log">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Flex vertical gap="middle">
        <div>
          <Button danger type="primary" htmlType="submit" loading={busy}>
            Revoke
          </Button>
        </div>
        <ErrorAlert error={error} />
      </Flex>
    </Form>
  );
}
