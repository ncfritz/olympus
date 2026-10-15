"use client";

import { Form, message, Modal, Typography } from "antd";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { Issuer } from "@/lib/api/types";
import { readCrlIssuer } from "@/lib/pem";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "../ErrorAlert";
import { PemInput } from "../PemInput";
import styles from "./Import.module.css";
import { REFRESHED } from "./refreshed";

/**
 * A CA's newest list from XCA (ADR 0037), before Harpocrates signs one:
 * its number continues from it, and its revocations carry into every
 * list after.
 */
export function ImportCrlModal({
  issuer,
  open,
  onClose,
}: {
  issuer: Issuer;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<{ crl?: string }>();
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const name = commonName(issuer.subject);

  const submit = async () => {
    const { crl } = await form.validateFields();
    setBusy(true);
    setError(undefined);
    try {
      const imported = unwrap(
        await apiClient.POST("/v1/issuer/{issuerId}/crls", {
          params: { path: { issuerId: issuer.id } },
          body: { crl: crl! },
        }),
      ).crl;
      await mutate(REFRESHED);
      onClose();
      void messages.success(
        `Imported list #${imported.number}, ${imported.entries} revoked: from now on Harpocrates publishes its lists`,
      );
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {messageHolder}
      <Modal
        title="Import its revocation list"
        open={open}
        onCancel={onClose}
        onOk={() => void submit().catch(() => undefined)}
        okText="Import the list"
        confirmLoading={busy}
        width={640}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary" className={styles.intro}>
          Its newest list from XCA, before Harpocrates signs one: the numbering
          continues from it and its revocations carry into every list after.
          Stop XCA publishing its lists once it is imported.
        </Typography.Paragraph>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="crl"
            label="The list"
            extra="XCA: the CA → Generate CRL, then Revocation lists → Export. Generate it after the last revocation in XCA."
            rules={[
              { required: true, message: "Drop, choose or paste it" },
              {
                validator: (_, value?: string) => {
                  const by = value ? readCrlIssuer(value) : undefined;
                  return !by || by === name
                    ? Promise.resolve()
                    : Promise.reject(new Error(`Signed by ${by}, not ${name}`));
                },
              },
            ]}
          >
            <PemInput kind="crl" rows={4} />
          </Form.Item>
        </Form>
        <ErrorAlert error={error} title="It could not be imported" />
      </Modal>
    </>
  );
}
