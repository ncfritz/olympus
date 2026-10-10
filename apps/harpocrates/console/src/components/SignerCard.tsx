"use client";

import { LockOutlined, UnlockOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Descriptions,
  Flex,
  Form,
  Input,
  Popconfirm,
  Tag,
} from "antd";
import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { expectOk } from "@/lib/api/errors";
import { KEYS, useCurrentUser, useSignerStatus } from "@/lib/api/queries";
import { ErrorAlert } from "./ErrorAlert";

const REASONS: Record<string, string> = {
  uninitialised: "Not initialised",
  deliberate: "Sealed by an admin",
  "no-unseal-key": "Started without its unseal key",
  "wrong-unseal-key": "Its unseal key did not open the store",
};

/**
 * The signer's seal (ADR 0020, Key protection), and an admin's controls
 * for it: the recovery passphrase unseals it, sealing stops all signing.
 */
export function SignerCard() {
  const { data: status } = useSignerStatus();
  const { isAdmin } = useCurrentUser();
  const { mutate } = useSWRConfig();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
      setError(undefined);
      await mutate(KEYS.signer);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Signer" loading={!status}>
      {status && (
        <Flex vertical gap="middle">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="State">
              {!status.initialised ? (
                <Tag>Not initialised</Tag>
              ) : status.sealed ? (
                <Tag color="red" icon={<LockOutlined />}>
                  Sealed
                </Tag>
              ) : (
                <Tag color="green" icon={<UnlockOutlined />}>
                  Unsealed
                </Tag>
              )}
            </Descriptions.Item>
            {status.reason && (
              <Descriptions.Item label="Why">
                {REASONS[status.reason] ?? status.reason}
              </Descriptions.Item>
            )}
            {status.ceremonyId && (
              <Descriptions.Item label="Ceremony">
                <Link href={`/ceremony?id=${status.ceremonyId}`}>
                  Open: {status.ceremonyId}
                </Link>
              </Descriptions.Item>
            )}
          </Descriptions>
          {!status.initialised && (
            <Link href="/setup">
              <Button type="primary" disabled={!isAdmin}>
                Set up the signer
              </Button>
            </Link>
          )}
          {status.initialised && status.sealed && isAdmin && (
            <Form<{ passphrase: string }>
              layout="inline"
              onFinish={({ passphrase }) =>
                act(async () => {
                  expectOk(
                    await apiClient.POST("/v1/signer/unseal", {
                      body: { passphrase },
                    }),
                  );
                })
              }
            >
              <Form.Item
                name="passphrase"
                rules={[{ required: true, message: "The recovery passphrase" }]}
              >
                <Input.Password
                  placeholder="Recovery passphrase"
                  autoComplete="off"
                />
              </Form.Item>
              <Button htmlType="submit" loading={busy}>
                Unseal
              </Button>
            </Form>
          )}
          {status.initialised && !status.sealed && isAdmin && (
            <Popconfirm
              title="Seal the signer?"
              description="Nothing signs until it is unsealed with the recovery passphrase, and an open ceremony ends."
              okText="Seal"
              okButtonProps={{ danger: true }}
              onConfirm={() =>
                act(async () => {
                  expectOk(await apiClient.POST("/v1/signer/seal"));
                })
              }
            >
              <Button danger icon={<LockOutlined />} loading={busy}>
                Seal
              </Button>
            </Popconfirm>
          )}
          <ErrorAlert error={error} />
        </Flex>
      )}
    </Card>
  );
}
