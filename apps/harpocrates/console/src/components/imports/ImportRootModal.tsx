"use client";

import { Flex, Form, Input, InputNumber, Modal, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { numberingOf, readCaCertificate, slugOf } from "@/lib/pem";
import { ErrorAlert } from "../ErrorAlert";
import { PemInput } from "../PemInput";
import styles from "./Import.module.css";
import { REFRESHED } from "./refreshed";

/** The API asks every import for one; a root's is set from its tier. */
const MAX_VALIDITY_DAYS = 825;

type Values = {
  certificate?: string;
  id: string;
  number: number;
  generation: number;
  csr?: string;
};

/**
 * Imports a root another product made (XCA; ADR 0037, 0039), from the
 * roots page: its certificate, which fills in its ID, number and
 * generation, and its CSR if there is one. Its key stays offline.
 */
export function ImportRootModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  /** What the certificate says, into each field not yet touched. */
  const fill = (pem: string | undefined) => {
    const ca = pem ? readCaCertificate(pem) : undefined;
    if (!ca) return;
    const guessed: Partial<Values> = {
      id: slugOf(ca.commonName),
      ...numberingOf(ca.commonName),
    };
    form.setFieldsValue(
      Object.fromEntries(
        Object.entries(guessed).filter(
          ([name]) => !form.isFieldTouched(name as keyof Values),
        ),
      ),
    );
  };

  const submit = async () => {
    const values = await form.validateFields();
    setBusy(true);
    setError(undefined);
    try {
      unwrap(
        await apiClient.POST("/v1/issuers/import", {
          body: {
            id: values.id,
            certificate: values.certificate!,
            chain: [],
            tier: "root",
            number: values.number,
            generation: values.generation,
            csr: values.csr || undefined,
            maxValidityDays: MAX_VALIDITY_DAYS,
            extendedKeyUsages: [],
          },
        }),
      );
      await mutate(REFRESHED);
      onClose();
      router.push(`/ca?id=${encodeURIComponent(values.id)}`);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Import a root"
      open={open}
      onCancel={onClose}
      onOk={() => void submit().catch(() => undefined)}
      okText="Import the root"
      confirmLoading={busy}
      width={640}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" className={styles.intro}>
        A root another product made (XCA), kept as a record and to revoke what
        it signed as it is replaced. Its key stays where XCA keeps it, and comes
        out only for a ceremony.
      </Typography.Paragraph>
      <Form<Values>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ number: 1, generation: 1 }}
        onValuesChange={(changed: Partial<Values>) => {
          if ("certificate" in changed) fill(changed.certificate);
        }}
      >
        <Form.Item
          name="certificate"
          label="Its certificate"
          extra="XCA: Certificates → the CA → Export, PEM. It fills in the rest."
          rules={[
            { required: true, message: "Drop, choose or paste it" },
            {
              validator: (_, value?: string) => {
                if (!value) return Promise.resolve();
                const ca = readCaCertificate(value);
                if (!ca?.ca) {
                  return Promise.reject(new Error("One CA certificate"));
                }
                if (!ca.selfSigned) {
                  return Promise.reject(
                    new Error(
                      `Signed by ${ca.issuerName}: a root signs itself. Import it from its parent's page`,
                    ),
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <PemInput kind="certificate" rows={4} />
        </Form.Item>
        <Flex gap="small">
          <Form.Item
            name="id"
            label="ID"
            tooltip="A slug to know it by"
            className={styles.id}
            rules={[
              { required: true, message: "Required" },
              {
                pattern: /^[a-z][a-z0-9-]{0,62}$/,
                message: "Lower case, digits and hyphens",
              },
            ]}
          >
            <Input placeholder="xca-root-ca" />
          </Form.Item>
          <Form.Item
            name="number"
            label="Number"
            rules={[{ required: true, message: "Required" }]}
          >
            <InputNumber min={1} max={999} className={styles.number} />
          </Form.Item>
          <Form.Item
            name="generation"
            label="Generation"
            rules={[{ required: true, message: "Required" }]}
          >
            <InputNumber min={1} max={999} className={styles.number} />
          </Form.Item>
        </Flex>
        <Form.Item
          name="csr"
          label="Its CSR"
          extra="Optional. XCA: Certificate signing requests → Export, PEM. It must be signed by the root's key."
        >
          <PemInput kind="csr" rows={3} />
        </Form.Item>
      </Form>
      <ErrorAlert error={error} title="It could not be imported" />
    </Modal>
  );
}
