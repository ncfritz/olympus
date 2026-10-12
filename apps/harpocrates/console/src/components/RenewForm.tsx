"use client";

import { Button, Flex, Form, Typography } from "antd";
import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { Certificate, FullCertificate } from "@/lib/api/types";
import { ErrorAlert } from "./ErrorAlert";
import { PemInput } from "./PemInput";

/**
 * Renewing a certificate (ADR 0020, Keys and enrollment): the same
 * subject, names and profile, from the profile's current issuer. The key
 * is certified again while it is young enough; a CSR for a new key
 * rekeys, and a generated key past its age is replaced.
 */
export function RenewForm({
  certificate,
  onRenewed,
}: {
  certificate: Certificate;
  onRenewed: (renewal: FullCertificate) => void;
}) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const subscriber = certificate.keyLocation === "subscriber";

  const renew = async ({ csr }: { csr?: string }) => {
    setBusy(true);
    try {
      const { certificate: renewal } = unwrap(
        await apiClient.POST("/v1/certificate/{certificateId}/renew", {
          params: { path: { certificateId: certificate.id } },
          body: { csr: csr?.trim() || undefined },
        }),
      );
      setError(undefined);
      onRenewed(renewal);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Form<{ csr?: string }> layout="vertical" onFinish={renew}>
      <Typography.Paragraph type="secondary">
        {subscriber
          ? "Without a CSR the same key is certified again while it is younger than the profile allows; with one, the new key replaces it."
          : "The signer certifies the same key again while it is young enough, or generates a new one once it is not."}
      </Typography.Paragraph>
      {subscriber && (
        <Form.Item
          name="csr"
          label="CSR for a new key (optional)"
          rules={[
            {
              pattern: /-----BEGIN CERTIFICATE REQUEST-----/,
              message: "A PEM certificate request",
            },
          ]}
        >
          <PemInput kind="csr" rows={4} />
        </Form.Item>
      )}
      <Flex vertical gap="middle">
        <div>
          <Button type="primary" htmlType="submit" loading={busy}>
            Renew
          </Button>
        </div>
        <ErrorAlert error={error} />
      </Flex>
    </Form>
  );
}
