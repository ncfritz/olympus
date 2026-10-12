"use client";

import { DownOutlined, LockOutlined, UnlockOutlined } from "@ant-design/icons";
import { Dropdown, Form, Input, type MenuProps, Modal, Typography } from "antd";
import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { expectOk } from "@/lib/api/errors";
import { KEYS, useCurrentUser, useSignerStatus } from "@/lib/api/queries";
import { ErrorAlert } from "./ErrorAlert";
import styles from "./SignerStatusTag.module.css";

const REASONS: Record<string, string> = {
  uninitialised: "Not initialised",
  deliberate: "Sealed by an admin",
  "no-unseal-key": "Started without its unseal key",
  "wrong-unseal-key": "Its unseal key did not open the store",
};

/**
 * The signer's seal in the header, as a pill: a dot and its state. It
 * opens a menu to seal or unseal it (an admin's), or to set it up.
 */
export function SignerStatusTag() {
  const { data: status } = useSignerStatus();
  const { isAdmin } = useCurrentUser();
  const { mutate } = useSWRConfig();
  const [acting, setActing] = useState<"seal" | "unseal">();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm<{ passphrase: string }>();
  if (!status) return null;

  const [state, label] = !status.initialised
    ? ["uninitialised", "Signer not initialised"]
    : status.sealed
      ? ["sealed", "Signer sealed"]
      : ["unsealed", "Signer unsealed"];

  const close = () => {
    setActing(undefined);
    setError(undefined);
    form.resetFields();
  };

  const act = async () => {
    setBusy(true);
    try {
      if (acting === "seal") {
        expectOk(await apiClient.POST("/v1/signer/seal"));
      } else {
        const { passphrase } = await form.validateFields();
        expectOk(
          await apiClient.POST("/v1/signer/unseal", { body: { passphrase } }),
        );
      }
      await mutate(KEYS.signer);
      close();
    } catch (failure) {
      if (!(failure && typeof failure === "object" && "errorFields" in failure))
        setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const items: MenuProps["items"] = [
    {
      key: "state",
      type: "group",
      label: status.reason
        ? (REASONS[status.reason] ?? status.reason)
        : status.sealed
          ? "Nothing is signed while it is sealed"
          : "The signer is signing",
    },
    !status.initialised
      ? {
          key: "setup",
          disabled: !isAdmin,
          label: <Link href="/setup">Set up the signer</Link>,
        }
      : status.sealed
        ? {
            key: "unseal",
            icon: <UnlockOutlined />,
            disabled: !isAdmin,
            label: isAdmin ? "Unseal…" : "Unseal (an admin's)",
            onClick: () => setActing("unseal"),
          }
        : {
            key: "seal",
            icon: <LockOutlined />,
            danger: true,
            disabled: !isAdmin,
            label: isAdmin ? "Seal…" : "Seal (an admin's)",
            onClick: () => setActing("seal"),
          },
    ...(status.ceremonyId
      ? [
          {
            key: "ceremony",
            label: (
              <Link href={`/ceremony?id=${status.ceremonyId}`}>
                Open ceremony: {status.ceremonyId}
              </Link>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
        <button
          type="button"
          className={styles.pill}
          aria-label={`${label}: open the signer's menu`}
        >
          <span className={`${styles.dot} ${styles[state]}`} aria-hidden />
          {label}
          <DownOutlined className={styles.caret} />
        </button>
      </Dropdown>
      <Modal
        open={acting !== undefined}
        title={acting === "seal" ? "Seal the signer?" : "Unseal the signer"}
        okText={acting === "seal" ? "Seal" : "Unseal"}
        okButtonProps={{ danger: acting === "seal", loading: busy }}
        onOk={act}
        onCancel={close}
        destroyOnHidden
      >
        {acting === "seal" ? (
          <Typography.Paragraph>
            Nothing is signed until it is unsealed again, with the recovery
            passphrase: no certificates, lists or OCSP responses.
          </Typography.Paragraph>
        ) : (
          <Form form={form} layout="vertical" onFinish={act}>
            <Form.Item
              name="passphrase"
              label="Recovery passphrase"
              rules={[{ required: true, message: "The recovery passphrase" }]}
            >
              <Input.Password autoComplete="off" autoFocus />
            </Form.Item>
          </Form>
        )}
        <ErrorAlert error={error} />
      </Modal>
    </>
  );
}
