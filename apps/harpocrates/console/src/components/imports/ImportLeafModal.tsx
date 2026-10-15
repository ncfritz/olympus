"use client";

import {
  Alert,
  Button,
  Flex,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Steps,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { useProfiles } from "@/lib/api/queries";
import type { Issuer, KeyImportFormat } from "@/lib/api/types";
import {
  blocksOf,
  certificateSpkiOf,
  publicKeySpkiOf,
  readCaCertificate,
  readCsr,
} from "@/lib/pem";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "../ErrorAlert";
import { ImportKeyInput } from "../ImportKeyInput";
import { PemInput } from "../PemInput";
import styles from "./Import.module.css";
import { REFRESHED } from "./refreshed";

type Values = {
  format: KeyImportFormat;
  keyData?: string;
  passphrase?: string;
  csr?: string;
  certificate?: string;
  profileId?: string;
};

const STEPS = ["Key", "CSR", "Certificate"] as const;

/** What was read at each step, to hold the next ones against. */
type Read = {
  /** The key's public key (base64 DER) and type, as the signer read it. */
  key?: { spki: string; algorithm: string };
  /** The CSR's public key. */
  csr?: string;
};

/**
 * Imports one certificate another product issued (XCA; ADR 0037, 0039),
 * in the steps a child CA's import takes: its key (the signer reads it
 * and keeps nothing yet), its CSR, then the certificate and the profile
 * it is taken as issued under. From a CA's page, one that CA signed; from
 * the certificates list, one any CA here signed. The key and CSR may be
 * skipped (a CSR comes only with its key) and added later from the
 * certificate's page; a key, CSR and certificate that are not one
 * another's are said so at the step that finds it.
 */
export function ImportLeafModal({
  issuer,
  open,
  onClose,
}: {
  /** The CA that signed it; none from the certificates list. */
  issuer?: Issuer;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: profiles } = useProfiles();
  const [step, setStep] = useState(0);
  const [read, setRead] = useState<Read>({});
  const [problem, setProblem] = useState<{ step: number; text: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const format: KeyImportFormat = Form.useWatch("format", form) ?? "pem";
  const issuerName = issuer ? commonName(issuer.subject) : undefined;

  const fail = (at: number, text: string) => {
    setProblem({ step: at, text });
    return false;
  };

  /** The key, read by the signer: its public key, or why it could not be. */
  const readKey = async (): Promise<boolean> => {
    const values = await form.validateFields(["keyData", "passphrase"]);
    try {
      const answer = unwrap(
        await apiClient.POST("/v1/keys/read", {
          body: {
            format: form.getFieldValue("format") as KeyImportFormat,
            data: values.keyData!,
            passphrase: values.passphrase!,
          },
        }),
      );
      setRead((r) => ({
        ...r,
        key: {
          spki: publicKeySpkiOf(answer.publicKey),
          algorithm: answer.algorithm,
        },
      }));
      return true;
    } catch {
      return fail(
        0,
        "The key could not be read: it is not what its format says, or the password is wrong.",
      );
    }
  };

  /** The CSR, held against the key. */
  const checkCsr = async (): Promise<boolean> => {
    const pem = form.getFieldValue("csr") as string | undefined;
    const csr = pem ? await readCsr(pem) : undefined;
    if (!csr) return fail(1, "This is not a CSR.");
    if (read.key && csr.spki !== read.key.spki) {
      return fail(1, "The CSR is not the key's: their public keys differ.");
    }
    setRead((r) => ({ ...r, csr: csr.spki }));
    return true;
  };

  /** The certificate, held against the key, the CSR and its profile. */
  const checkCertificate = (values: Values): boolean => {
    const spki = certificateSpkiOf(values.certificate ?? "");
    if (read.key && spki !== read.key.spki) {
      return fail(
        2,
        "The certificate is not the key's: their public keys differ. Go back to the key.",
      );
    }
    if (read.csr && spki !== read.csr) {
      return fail(
        2,
        "The certificate is not the CSR's: their public keys differ. Go back to the CSR.",
      );
    }
    if (
      read.key &&
      !profiles?.find((p) => p.id === values.profileId)?.allowGenerated
    ) {
      return fail(
        2,
        "This profile takes CSRs only: its keys stay with the subscriber. Choose another, or go back and skip the key.",
      );
    }
    return true;
  };

  const next = async (skip = false) => {
    setProblem(undefined);
    if (step === 0) {
      if (skip) {
        form.setFieldsValue({ keyData: undefined, passphrase: undefined });
        setRead({});
        form.setFieldsValue({ csr: undefined });
      } else if (!(await readKey().catch(() => false))) return;
    }
    if (step === 1) {
      if (skip || !read.key) {
        form.setFieldsValue({ csr: undefined });
        setRead((r) => ({ ...r, csr: undefined }));
      } else if (!(await checkCsr())) return;
    }
    setStep(step + 1);
  };

  const submit = async () => {
    setProblem(undefined);
    const values = await form.validateFields();
    if (!checkCertificate(values)) return;
    setBusy(true);
    setError(undefined);
    try {
      const answer = unwrap(
        await apiClient.POST("/v1/certificates/import", {
          body: {
            profileId: values.profileId!,
            certificates: [values.certificate!],
            issuerId: issuer?.id,
            ...(read.key
              ? {
                  key: {
                    format: values.format,
                    data: values.keyData!,
                    passphrase: values.passphrase!,
                  },
                  csr: read.csr ? values.csr : undefined,
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

  const footer = (
    <Flex justify="space-between">
      <Button onClick={onClose}>Cancel</Button>
      <Flex gap="small">
        {step > 0 && (
          <Button
            onClick={() => {
              setProblem(undefined);
              setStep(step - 1);
            }}
          >
            Back
          </Button>
        )}
        {step < 2 && <Button onClick={() => void next(true)}>Skip</Button>}
        {step < 2 ? (
          <Button
            type="primary"
            disabled={step === 1 && !read.key}
            onClick={() => void next()}
          >
            Next
          </Button>
        ) : (
          <Button
            type="primary"
            loading={busy}
            onClick={() => void submit().catch(() => undefined)}
          >
            Import it
          </Button>
        )}
      </Flex>
    </Flex>
  );

  return (
    <Modal
      title={
        issuer
          ? `Import a certificate ${issuerName} signed`
          : "Import a certificate"
      }
      open={open}
      onCancel={onClose}
      footer={footer}
      width={640}
      destroyOnHidden
    >
      <Steps
        size="small"
        current={step}
        status={problem?.step === step ? "error" : undefined}
        className={styles.steps}
        items={STEPS.map((title, index) => ({
          title,
          description:
            index === 0 && step > 0
              ? read.key
                ? read.key.algorithm
                : "Skipped"
              : index === 1 && step > 1
                ? read.csr
                  ? "Its own"
                  : "Skipped"
                : undefined,
        }))}
      />
      <Form<Values>
        form={form}
        layout="vertical"
        initialValues={{ format: "pem" }}
        onValuesChange={() => setProblem(undefined)}
      >
        <div hidden={step !== 0}>
          <Typography.Paragraph type="secondary">
            Its key, if XCA has it: it goes to the signer, escrowed, so the
            certificate can be renewed with it, exported or deployed. The signer
            reads it now to check it against the CSR and certificate, and keeps
            it only when the certificate is imported. Skip it otherwise; it can
            be added later from the certificate&apos;s page.
          </Typography.Paragraph>
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
                ? "XCA: Certificates → the certificate → Export, PKCS#12. Only its key is used."
                : "XCA: Private keys → the key → Export, PKCS#8 encrypted."
            }
            rules={[
              { required: step === 0, message: "Bring the key, or skip it" },
              ...(format === "pem"
                ? [
                    {
                      pattern: /-----BEGIN ENCRYPTED PRIVATE KEY-----/,
                      message: "An encrypted PKCS#8 key",
                    },
                  ]
                : []),
            ]}
          >
            <ImportKeyInput format={format} />
          </Form.Item>
          <Form.Item
            name="passphrase"
            label="The key's password"
            extra="Used to read it, never kept"
            rules={[{ required: step === 0, message: "Required" }]}
          >
            <Input.Password autoComplete="off" />
          </Form.Item>
        </div>
        <div hidden={step !== 1}>
          {read.key ? (
            <>
              <Typography.Paragraph type="secondary">
                The CSR it was issued from, if XCA kept one; skip it otherwise.
              </Typography.Paragraph>
              <Form.Item
                name="csr"
                label="Its CSR"
                extra="XCA: Certificate signing requests → Export, PEM."
              >
                <PemInput kind="csr" rows={4} />
              </Form.Item>
            </>
          ) : (
            <Typography.Paragraph type="secondary">
              A certificate&apos;s CSR is kept only with its key (ADR 0039): go
              back to add the key, or skip the CSR. Both can be added later from
              the certificate&apos;s page.
            </Typography.Paragraph>
          )}
        </div>
        <div hidden={step !== 2}>
          <Form.Item
            name="certificate"
            label="The certificate"
            extra="XCA: Certificates → the certificate → Export, PEM. One already imported as a record gains the key given here."
            rules={[
              { required: step === 2, message: "Drop, choose or paste it" },
              {
                validator: (_, value?: string) => {
                  if (!value) return Promise.resolve();
                  const certificates = blocksOf(value).filter(
                    (b) => b.label === "CERTIFICATE",
                  );
                  if (certificates.length !== 1) {
                    return Promise.reject(new Error("One certificate"));
                  }
                  const ca = readCaCertificate(value);
                  if (ca?.ca) {
                    return Promise.reject(
                      new Error("A CA: import it as a child CA"),
                    );
                  }
                  if (issuer && ca && ca.issuerName !== issuerName) {
                    return Promise.reject(
                      new Error(
                        `Signed by ${ca.issuerName}, not ${issuerName}`,
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
            rules={[{ required: step === 2, message: "A profile" }]}
          >
            <Select
              showSearch
              placeholder="A profile"
              options={(profiles ?? [])
                .filter((p) => !p.ssh && (!read.key || p.allowGenerated))
                .map((p) => ({ value: p.id, label: p.id }))}
            />
          </Form.Item>
        </div>
      </Form>
      {problem && (
        <Alert
          type="error"
          showIcon
          title={problem.text}
          className={styles.problem}
        />
      )}
      <ErrorAlert error={error} title="It could not be imported" />
    </Modal>
  );
}
