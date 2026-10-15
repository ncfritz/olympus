"use client";

import { Form, message, Modal, Typography } from "antd";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { FullIssuer } from "@/lib/api/types";
import { certificateSpkiOf, readCsr } from "@/lib/pem";
import { ErrorAlert } from "../ErrorAlert";
import { PemInput } from "../PemInput";
import styles from "./Import.module.css";
import { REFRESHED } from "./refreshed";

/**
 * The CSR an imported CA's certificate was issued from (ADR 0039), while
 * it has none: signed by the key its certificate certifies.
 */
export function ImportIssuerCsrModal({
  issuer,
  open,
  onClose,
}: {
  issuer: FullIssuer;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<{ csr?: string }>();
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const ours = issuer.certificate
    ? certificateSpkiOf(issuer.certificate)
    : undefined;

  const submit = async () => {
    const { csr } = await form.validateFields();
    setBusy(true);
    setError(undefined);
    try {
      unwrap(
        await apiClient.POST("/v1/issuer/{issuerId}/csr", {
          params: { path: { issuerId: issuer.id } },
          body: { csr: csr! },
        }),
      );
      await mutate(REFRESHED);
      onClose();
      void messages.success("Its CSR is kept");
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
        title="Import its CSR"
        open={open}
        onCancel={onClose}
        onOk={() => void submit().catch(() => undefined)}
        okText="Import the CSR"
        confirmLoading={busy}
        width={640}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary" className={styles.intro}>
          The CSR its certificate was issued from, kept with it as a CA made
          here keeps its own. It must be signed by the key its certificate
          certifies.
        </Typography.Paragraph>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="csr"
            label="The CSR"
            extra="XCA: Certificate signing requests → Export, PEM."
            rules={[
              { required: true, message: "Drop, choose or paste it" },
              {
                validator: async (_, value?: string) => {
                  if (!value) return;
                  const csr = await readCsr(value);
                  if (!csr) throw new Error("This is not a CSR");
                  if (ours && csr.spki !== ours) {
                    throw new Error(
                      "The CSR is not this CA's: its public key differs",
                    );
                  }
                },
              },
            ]}
          >
            <PemInput kind="csr" rows={4} />
          </Form.Item>
        </Form>
        <ErrorAlert error={error} title="It could not be imported" />
      </Modal>
    </>
  );
}
