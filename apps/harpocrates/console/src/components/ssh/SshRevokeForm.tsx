"use client";

import { Alert, Button, Flex, Form, Input, Select } from "antd";
import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { RevocationReason, SshCertificate } from "@/lib/api/types";
import { ErrorAlert } from "../ErrorAlert";
import { REASONS } from "../RevokeForm";

interface Values {
  reason: RevocationReason;
  comment?: string;
}

/**
 * Revoking an SSH certificate (ADR 0035): its CA's KRL lists it at once,
 * and hosts refuse it once they have fetched that. keyCompromise also
 * blocks the key and revokes its other SSH certificates.
 */
export function SshRevokeForm({
  certificate,
  onRevoked,
}: {
  certificate: SshCertificate;
  onRevoked: (revoked: SshCertificate) => void;
}) {
  const [form] = Form.useForm<Values>();
  const reason = Form.useWatch("reason", form);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  const revoke = async (values: Values) => {
    setBusy(true);
    try {
      const revoked = unwrap(
        await apiClient.POST("/v1/ssh/certificate/{certificateId}/revoke", {
          params: { path: { certificateId: certificate.id } },
          body: { reason: values.reason, comment: values.comment || undefined },
        }),
      ).certificate;
      setError(undefined);
      onRevoked(revoked);
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
          title="Every SSH certificate for this key is revoked, and the key is blocked for good"
          description="Nothing can certify this key again."
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
