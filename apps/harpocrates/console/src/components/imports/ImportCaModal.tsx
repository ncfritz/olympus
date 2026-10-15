"use client";

import {
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Switch,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { Issuer } from "@/lib/api/types";
import { EKU_NAMES, TIERS } from "@/lib/labels";
import { numberingOf, readCaCertificate, slugOf } from "@/lib/pem";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "../ErrorAlert";
import { PemInput } from "../PemInput";
import styles from "./Import.module.css";
import { REFRESHED } from "./refreshed";

/** The longest certificate an imported issuing CA signs, by default. */
const ISSUING_MAX_VALIDITY_DAYS = 825;

type Tier = "root" | "intermediate" | "issuing";

type Values = {
  certificate?: string;
  id: string;
  number: number;
  generation: number;
  tier: Tier;
  csr?: string;
  privateKey?: string;
  passphrase?: string;
  purpose?: string;
  maxValidityDays: number;
  extendedKeyUsages: string[];
  closed: boolean;
};

/**
 * Imports one CA another product made (XCA; ADR 0037, 0039): a root from
 * the roots page, or a CA beneath `parent` from its page, an intermediate
 * or an issuing CA. Its certificate fills in its ID, number and
 * generation; its CSR is optional; an issuing CA comes with its key.
 */
export function ImportCaModal({
  parent,
  open,
  onClose,
}: {
  /** The CA it is beneath; none for a root. */
  parent?: Issuer;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const tier: Tier =
    Form.useWatch("tier", form) ?? (parent ? "issuing" : "root");
  const issuing = tier === "issuing";
  const parentName = parent ? commonName(parent.subject) : undefined;

  /** What the certificate says, into each field not yet touched. */
  const fill = (pem: string | undefined) => {
    const ca = pem ? readCaCertificate(pem) : undefined;
    if (!ca) return;
    const guessed: Partial<Values> = {
      id: slugOf(ca.commonName),
      ...numberingOf(ca.commonName),
      ...(parent
        ? { tier: ca.pathLength === 0 ? "issuing" : "intermediate" }
        : {}),
      ...(ca.extendedKeyUsages.length
        ? { extendedKeyUsages: ca.extendedKeyUsages }
        : {}),
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
      const above = parent
        ? unwrap(
            await apiClient.GET("/v1/issuer/{issuerId}", {
              params: { path: { issuerId: parent.id } },
            }),
          ).issuer
        : undefined;
      unwrap(
        await apiClient.POST("/v1/issuers/import", {
          body: {
            id: values.id,
            certificate: values.certificate!,
            chain: above?.certificate
              ? [above.certificate, ...above.chain]
              : [],
            tier: values.tier,
            number: values.number,
            generation: values.generation,
            csr: values.csr || undefined,
            purpose: issuing ? values.purpose || undefined : undefined,
            // An offline CA's is set by the service from its tier; the API
            // still asks for one, so it gets the issuing default.
            maxValidityDays: issuing
              ? values.maxValidityDays
              : ISSUING_MAX_VALIDITY_DAYS,
            extendedKeyUsages: issuing ? values.extendedKeyUsages : [],
            privateKey: issuing ? values.privateKey : undefined,
            passphrase: issuing ? values.passphrase : undefined,
            closed: issuing ? values.closed : undefined,
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
      title={parent ? `Import a CA beneath ${parentName}` : "Import a root"}
      open={open}
      onCancel={onClose}
      onOk={() => void submit().catch(() => undefined)}
      okText={parent ? "Import the CA" : "Import the root"}
      confirmLoading={busy}
      width={640}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" className={styles.intro}>
        {parent
          ? "A CA another product made (XCA) and this one signed, kept as a record and to revoke it as it is replaced."
          : "A root another product made (XCA), kept as a record and to revoke what it signed as it is replaced. Its key stays where it is kept."}
      </Typography.Paragraph>
      <Form<Values>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{
          tier: parent ? "issuing" : "root",
          number: 1,
          generation: 1,
          maxValidityDays: ISSUING_MAX_VALIDITY_DAYS,
          extendedKeyUsages: ["1.3.6.1.5.5.7.3.1", "1.3.6.1.5.5.7.3.2"],
          closed: true,
        }}
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
                if (!parent && !ca.selfSigned) {
                  return Promise.reject(
                    new Error(
                      `Signed by ${ca.issuerName}: a root signs itself. Import it from its parent's page`,
                    ),
                  );
                }
                if (parent && ca.issuerName !== parentName) {
                  return Promise.reject(
                    new Error(`Signed by ${ca.issuerName}, not ${parentName}`),
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
            <Input placeholder={parent ? "xca-issuing-ca-1" : "xca-root-ca"} />
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
        {parent ? (
          <Form.Item name="tier" label="Tier">
            <Radio.Group
              optionType="button"
              options={(["intermediate", "issuing"] as const).map((value) => ({
                value,
                label: TIERS[value],
              }))}
            />
          </Form.Item>
        ) : (
          <Form.Item name="tier" hidden>
            <Input />
          </Form.Item>
        )}
        <Form.Item
          name="csr"
          label="Its CSR"
          extra={`Optional. XCA: Certificate signing requests → Export, PEM. It must be signed by the ${tier === "root" ? "root's" : "CA's"} key.`}
        >
          <PemInput kind="csr" rows={3} />
        </Form.Item>
        {issuing ? (
          <>
            <Form.Item
              name="privateKey"
              label="Its key"
              extra="XCA: Private keys → Export, PKCS#8 encrypted. It goes to the signer."
              rules={[
                { required: true, message: "An issuing CA comes with its key" },
                {
                  pattern: /-----BEGIN ENCRYPTED PRIVATE KEY-----/,
                  message: "An encrypted private key (PKCS#8)",
                },
              ]}
            >
              <PemInput kind="key" rows={3} />
            </Form.Item>
            <Form.Item
              name="passphrase"
              label="The key's password"
              extra="Used once to read it, never kept"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input.Password autoComplete="off" />
            </Form.Item>
            <Flex gap="small">
              <Form.Item name="purpose" label="Purpose" className={styles.id}>
                <Input placeholder="TLS, Service, Device" />
              </Form.Item>
              <Form.Item
                name="maxValidityDays"
                label="Longest certificate, days"
                rules={[{ required: true, message: "Required" }]}
              >
                <InputNumber min={1} />
              </Form.Item>
            </Flex>
            <Form.Item
              name="extendedKeyUsages"
              label="Extended key usages it may sign"
            >
              <Select
                mode="tags"
                options={Object.entries(EKU_NAMES).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="closed"
              label="Closed"
              valuePropName="checked"
              extra="It signs its revocation lists and nothing new: XCA's CAs are imported closed (ADR 0037)."
            >
              <Switch />
            </Form.Item>
          </>
        ) : (
          <Typography.Paragraph type="secondary">
            {tier === "root" ? "A root" : "An intermediate"} is imported by its
            certificate alone: its key stays where XCA keeps it, and comes out
            only for a ceremony.
          </Typography.Paragraph>
        )}
      </Form>
      <ErrorAlert error={error} title="It could not be imported" />
    </Modal>
  );
}
