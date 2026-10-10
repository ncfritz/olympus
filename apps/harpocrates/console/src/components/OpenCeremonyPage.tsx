"use client";

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  Form,
  Input,
  Typography,
} from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS, useIssuer, useSignerStatus } from "@/lib/api/queries";
import { SIGNS_LABEL, signsOf } from "@/lib/signs";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "./ErrorAlert";
import { KeyFileInput } from "./KeyFileInput";

/**
 * A ceremony (ADR 0020, 0032): an offline CA's key, given back from the
 * offline media, held by the signer for one sitting. A root's first
 * ceremony proves its backup and signs its first revocation list.
 */
export function OpenCeremonyPage() {
  const issuerId = useSearchParams().get("issuerId") ?? undefined;
  const { data: issuer, error: notFound } = useIssuer(issuerId);
  const { data: status } = useSignerStatus();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  if (!issuerId)
    return (
      <Alert type="error" title="Which CA? Open a ceremony from its page." />
    );
  if (notFound) return <ErrorAlert error={notFound} />;
  if (!issuer) return null;

  const first = !issuer.provedAt;
  const open = async (values: { privateKey: string; passphrase: string }) => {
    setBusy(true);
    try {
      const { ceremony } = unwrap(
        await apiClient.POST("/v1/ceremonies", {
          body: { issuerId, ...values },
        }),
      );
      await Promise.all([mutate(KEYS.signer), mutate(KEYS.issuer(issuerId))]);
      router.push(`/ceremony?id=${ceremony.id}`);
    } catch (failure) {
      setError(failure);
      setBusy(false);
    }
  };

  return (
    <Flex vertical gap="large">
      <Typography.Title level={3}>
        {first ? "Prove the backup" : "Open a ceremony"}
      </Typography.Title>
      <Card>
        <Flex vertical gap="large">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="CA">
              <Link href={`/ca?id=${issuer.id}`}>
                {commonName(issuer.subject)}
              </Link>
            </Descriptions.Item>
            <Descriptions.Item label="Signs">
              {SIGNS_LABEL[signsOf(issuer)]}
            </Descriptions.Item>
          </Descriptions>
          {first ? (
            <Alert
              type="info"
              showIcon
              title="Give the key back from the offline media"
              description="Before this CA signs anything, its key file and passphrase must open it: that proves the backup works. This first ceremony also signs its first revocation list, which is published before anything beneath it."
            />
          ) : (
            <Typography.Text type="secondary">
              The signer holds the key for this sitting only: it is forgotten
              when the ceremony closes, times out, or the signer is sealed or
              restarted.
            </Typography.Text>
          )}
          {status?.ceremonyId && (
            <Alert
              type="warning"
              showIcon
              title="A ceremony is already open"
              description={
                <Link href={`/ceremony?id=${status.ceremonyId}`}>
                  Go to it, and close it before opening another
                </Link>
              }
            />
          )}
          <Form<{ privateKey: string; passphrase: string }>
            layout="vertical"
            onFinish={open}
          >
            <Form.Item
              name="privateKey"
              label="Key file"
              rules={[{ required: true, message: "Its encrypted key file" }]}
            >
              <KeyFileInput />
            </Form.Item>
            <Form.Item
              name="passphrase"
              label="Export passphrase"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input.Password autoComplete="off" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={busy}>
              {first ? "Prove and open" : "Open the ceremony"}
            </Button>
          </Form>
          <ErrorAlert error={error} />
        </Flex>
      </Card>
    </Flex>
  );
}
