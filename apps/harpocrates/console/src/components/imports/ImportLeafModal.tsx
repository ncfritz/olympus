"use client";

import { Form, Input, Modal, Radio, Select, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { useProfiles } from "@/lib/api/queries";
import type { Issuer, KeyImportFormat } from "@/lib/api/types";
import { blocksOf, readCaCertificate } from "@/lib/pem";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "../ErrorAlert";
import { ImportKeyInput } from "../ImportKeyInput";
import { PemInput } from "../PemInput";
import styles from "./Import.module.css";
import { REFRESHED } from "./refreshed";

type Values = {
  certificate?: string;
  profileId?: string;
  format: KeyImportFormat;
  keyData?: string;
  passphrase?: string;
  csr?: string;
};

/**
 * Imports one certificate another product issued (XCA; ADR 0037, 0039):
 * from an issuing CA's page, one it signed; from the certificates list,
 * one any CA here signed. Optionally with its key (escrowed in the
 * signer) and, with the key, its CSR; either can be added later from the
 * certificate's page.
 */
export function ImportLeafModal({
  issuer,
  open,
  onClose,
}: {
  /** The issuing CA that signed it; none from the certificates list. */
  issuer?: Issuer;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: profiles } = useProfiles();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const format: KeyImportFormat = Form.useWatch("format", form) ?? "pem";
  const keyData = Form.useWatch("keyData", form);
  const withKey = Boolean(keyData);
  const issuerName = issuer ? commonName(issuer.subject) : undefined;

  const submit = async () => {
    const values = await form.validateFields();
    setBusy(true);
    setError(undefined);
    try {
      const answer = unwrap(
        await apiClient.POST("/v1/certificates/import", {
          body: {
            profileId: values.profileId!,
            certificates: [values.certificate!],
            issuerId: issuer?.id,
            ...(values.keyData
              ? {
                  key: {
                    format: values.format,
                    data: values.keyData,
                    passphrase: values.passphrase!,
                  },
                  csr: values.csr || undefined,
                }
              : {}),
          },
        }),
      );
      const done = answer.imported[0] ?? answer.keyed[0];
      if (!done) {
        throw new Error(answer.skipped[0]?.reason ?? "Nothing was imported");
      }
      await mutate(REFRESHED);
      onClose();
      router.push(`/certificate?id=${done.id}`);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={
        issuer
          ? `Import a certificate ${issuerName} signed`
          : "Import a certificate"
      }
      open={open}
      onCancel={onClose}
      onOk={() => void submit().catch(() => undefined)}
      okText="Import it"
      confirmLoading={busy}
      width={640}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" className={styles.intro}>
        A certificate another product issued (XCA), kept as a record and to
        revoke it once it is replaced. Its key and CSR are optional: either can
        be added later from its page.
      </Typography.Paragraph>
      <Form<Values>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ format: "pem" }}
      >
        <Form.Item
          name="certificate"
          label="The certificate"
          extra="XCA: Certificates → the certificate → Export, PEM. One already imported as a record gains the key given here."
          rules={[
            { required: true, message: "Drop, choose or paste it" },
            {
              validator: (_, value?: string) => {
                if (!value) return Promise.resolve();
                const certificates = blocksOf(value).filter(
                  (b) => b.label === "CERTIFICATE",
                );
                if (certificates.length !== 1) {
                  return Promise.reject(new Error("One certificate"));
                }
                const read = readCaCertificate(value);
                if (read?.ca) {
                  return Promise.reject(
                    new Error("A CA: import it from its parent's page"),
                  );
                }
                if (issuer && read && read.issuerName !== issuerName) {
                  return Promise.reject(
                    new Error(
                      `Signed by ${read.issuerName}, not ${issuerName}`,
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
        <Form.Item
          name="profileId"
          label="Taken as issued under"
          extra="Renewing it later follows this profile, from its CA in the new hierarchy."
          dependencies={["keyData"]}
          rules={[
            { required: true, message: "A profile" },
            {
              validator: (_, value?: string) =>
                !value ||
                !form.getFieldValue("keyData") ||
                profiles?.find((p) => p.id === value)?.allowGenerated
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error(
                        "This profile takes CSRs only: its keys stay with the subscriber",
                      ),
                    ),
            },
          ]}
        >
          <Select
            showSearch
            placeholder="A profile"
            options={(profiles ?? [])
              .filter((p) => !p.ssh)
              .map((p) => ({ value: p.id, label: p.id }))}
          />
        </Form.Item>
        <Form.Item name="format" label="Its key">
          <Radio.Group
            options={[
              { value: "pem", label: "Encrypted PKCS#8 (PEM)" },
              { value: "pkcs12", label: "PKCS#12 (.p12, .pfx)" },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="keyData"
          extra={
            format === "pkcs12"
              ? "Optional. XCA: Certificates → the certificate → Export, PKCS#12. Only its key is used; it goes to the signer, escrowed."
              : "Optional. XCA: Private keys → the key → Export, PKCS#8 encrypted. It goes to the signer, escrowed."
          }
          rules={
            format === "pem"
              ? [
                  {
                    pattern: /-----BEGIN ENCRYPTED PRIVATE KEY-----/,
                    message: "An encrypted PKCS#8 key",
                  },
                ]
              : []
          }
        >
          <ImportKeyInput format={format} />
        </Form.Item>
        {withKey && (
          <>
            <Form.Item
              name="passphrase"
              label="The key's password"
              extra="Used once to read it, never kept"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input.Password autoComplete="off" />
            </Form.Item>
            <Form.Item
              name="csr"
              label="Its CSR"
              extra="Optional. XCA: Certificate signing requests → Export, PEM. It must be signed by the key."
            >
              <PemInput kind="csr" rows={3} />
            </Form.Item>
          </>
        )}
      </Form>
      <ErrorAlert error={error} title="It could not be imported" />
    </Modal>
  );
}
