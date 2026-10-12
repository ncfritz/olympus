"use client";

import {
  Alert,
  Descriptions,
  Flex,
  Form,
  Input,
  Modal,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS } from "@/lib/api/queries";
import type { Issuer } from "@/lib/api/types";
import { SIGNS_LABEL, signsOf } from "@/lib/signs";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "./ErrorAlert";
import { KeyFileInput } from "./KeyFileInput";

type Values = { privateKey: string; passphrase: string };

/**
 * Opening a ceremony (ADR 0020, 0032): an offline CA's key, given back
 * from the offline media, held by the signer for one sitting. A root's
 * first ceremony proves its backup and signs its first revocation list.
 * Opened, it goes to the ceremony's page.
 */
export function OpenCeremonyModal({
  issuer,
  open,
  onClose,
}: {
  issuer: Issuer;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const first = !issuer.provedAt;

  const submit = async (values: Values) => {
    setBusy(true);
    try {
      const { ceremony } = unwrap(
        await apiClient.POST("/v1/ceremonies", {
          body: { issuerId: issuer.id, ...values },
        }),
      );
      await Promise.all([
        mutate(KEYS.signer),
        mutate(KEYS.issuer(issuer.id)),
        mutate(KEYS.issuerCeremonies(issuer.id)),
      ]);
      router.push(`/ceremony?id=${ceremony.id}`);
    } catch (failure) {
      setError(failure);
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={first ? "Prove the backup" : "Open a ceremony"}
      okText={first ? "Prove and open" : "Open the ceremony"}
      confirmLoading={busy}
      onOk={() => form.submit()}
      onCancel={() => {
        form.resetFields();
        setError(undefined);
        onClose();
      }}
      destroyOnHidden
    >
      <Flex vertical gap="middle">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="CA">
            {commonName(issuer.subject)}
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
            The signer holds the key for this sitting only: it is forgotten when
            the ceremony closes, times out, or the signer is sealed or
            restarted.
          </Typography.Text>
        )}
        <Form<Values> form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            name="privateKey"
            label="Key file"
            rules={[
              { required: true, message: "Its encrypted key file" },
              {
                pattern: /-----BEGIN ENCRYPTED PRIVATE KEY-----/,
                message: "An encrypted private key (PKCS#8)",
              },
            ]}
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
        </Form>
        <ErrorAlert error={error} />
      </Flex>
    </Modal>
  );
}
