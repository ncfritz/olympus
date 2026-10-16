"use client";

import {
  Alert,
  Button,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Steps,
  Switch,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { Issuer } from "@/lib/api/types";
import { EKU_NAMES, TIERS } from "@/lib/labels";
import {
  certificateSpkiOf,
  numberingOf,
  publicKeySpkiOf,
  readCaCertificate,
  readCsr,
  slugOf,
} from "@/lib/pem";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "../ErrorAlert";
import { PemInput } from "../PemInput";
import styles from "./Import.module.css";
import { REFRESHED } from "./refreshed";

/** The longest certificate an imported issuing CA signs, by default. */
const ISSUING_MAX_VALIDITY_DAYS = 825;

type Tier = "intermediate" | "issuing";

type Values = {
  privateKey?: string;
  passphrase?: string;
  csr?: string;
  certificate?: string;
  id: string;
  number: number;
  generation: number;
  tier: Tier;
  purpose?: string;
  maxValidityDays: number;
  extendedKeyUsages: string[];
  closed: boolean;
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
 * Imports a CA another product made (XCA; ADR 0037, 0039) beneath
 * `parent`, in steps: its key (the signer reads it and keeps nothing yet),
 * its CSR, then its certificate. The key is skipped for an intermediate,
 * whose key stays offline, and the CSR whenever there is none; a key, CSR
 * and certificate that are not one another's are said so at the step
 * that finds it, before anything is kept.
 */
export function ImportChildCaModal({
  parent,
  open,
  onClose,
}: {
  parent: Issuer;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [step, setStep] = useState(0);
  const [read, setRead] = useState<Read>({});
  const [problem, setProblem] = useState<{ step: number; text: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const tier: Tier = Form.useWatch("tier", form) ?? "issuing";
  const certificate = Form.useWatch("certificate", form) as string | undefined;
  const certified = certificate ? readCaCertificate(certificate) : undefined;
  /**
   * An issuing CA whose certificate does not say path length 0 could sign
   * a CA: its key is held to sign its lists only, so it comes in closed
   * (ADR 0041).
   */
  const listsOnly =
    tier === "issuing" && !!certified?.ca && certified.pathLength !== 0;
  useEffect(() => {
    if (listsOnly) form.setFieldValue("closed", true);
  }, [form, listsOnly]);
  const parentName = commonName(parent.subject);

  /** What the certificate says, into each field not yet touched. */
  const fill = (pem: string | undefined) => {
    const ca = pem ? readCaCertificate(pem) : undefined;
    if (!ca) return;
    const guessed: Partial<Values> = {
      id: slugOf(ca.commonName),
      ...numberingOf(ca.commonName),
      // With its key it is an issuing CA: an intermediate's stays offline.
      tier: ca.pathLength === 0 || read.key ? "issuing" : "intermediate",
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

  const fail = (at: number, text: string) => {
    setProblem({ step: at, text });
    return false;
  };

  /** The key, read by the signer: its public key, or why it could not be. */
  const readKey = async (): Promise<boolean> => {
    const { privateKey, passphrase } = await form.validateFields([
      "privateKey",
      "passphrase",
    ]);
    try {
      const answer = unwrap(
        await apiClient.POST("/v1/keys/read", {
          body: { format: "pem", data: privateKey!, passphrase: passphrase! },
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
        "The key could not be read: it is not encrypted PKCS#8, or the password is wrong.",
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

  /** The certificate, held against the key, the CSR and its tier. */
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
    if (values.tier === "issuing" && !read.key) {
      return fail(
        2,
        "An issuing CA comes with its key: go back to the key, which the signer will hold.",
      );
    }
    if (
      values.tier === "issuing" &&
      !values.closed &&
      readCaCertificate(values.certificate ?? "")?.pathLength !== 0
    ) {
      return fail(
        2,
        "Its certificate does not say path length 0, so it is imported closed: it signs its lists only (ADR 0041).",
      );
    }
    if (values.tier === "intermediate" && read.key) {
      return fail(
        2,
        "An intermediate is imported without its key, which stays offline: go back and skip the key.",
      );
    }
    return true;
  };

  const next = async (skip = false) => {
    setProblem(undefined);
    if (step === 0) {
      if (skip) {
        form.setFieldsValue({ privateKey: undefined, passphrase: undefined });
        setRead((r) => ({ ...r, key: undefined }));
      } else if (!(await readKey().catch(() => false))) return;
    }
    if (step === 1) {
      if (skip) {
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
    const issuing = values.tier === "issuing";
    setBusy(true);
    setError(undefined);
    try {
      const above = unwrap(
        await apiClient.GET("/v1/issuer/{issuerId}", {
          params: { path: { issuerId: parent.id } },
        }),
      ).issuer;
      unwrap(
        await apiClient.POST("/v1/issuers/import", {
          body: {
            id: values.id,
            certificate: values.certificate!,
            chain: above.certificate ? [above.certificate, ...above.chain] : [],
            tier: values.tier,
            number: values.number,
            generation: values.generation,
            csr: read.csr ? values.csr : undefined,
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
          <Button type="primary" onClick={() => void next()}>
            Next
          </Button>
        ) : (
          <Button
            type="primary"
            loading={busy}
            onClick={() => void submit().catch(() => undefined)}
          >
            Import the CA
          </Button>
        )}
      </Flex>
    </Flex>
  );

  return (
    <Modal
      title={`Import a CA beneath ${parentName}`}
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
        initialValues={{
          tier: "issuing",
          number: 1,
          generation: 1,
          maxValidityDays: ISSUING_MAX_VALIDITY_DAYS,
          extendedKeyUsages: ["1.3.6.1.5.5.7.3.1", "1.3.6.1.5.5.7.3.2"],
          closed: true,
        }}
        onValuesChange={(changed: Partial<Values>) => {
          if ("certificate" in changed) fill(changed.certificate);
          setProblem(undefined);
        }}
      >
        <div hidden={step !== 0}>
          <Typography.Paragraph type="secondary">
            An issuing CA&apos;s key goes to the signer; an intermediate&apos;s
            stays offline, so skip it. The signer reads it now to check it
            against the CSR and certificate, and keeps it only when the CA is
            imported.
          </Typography.Paragraph>
          <Form.Item
            name="privateKey"
            label="Its key"
            extra="XCA: Private keys → the key → Export, PKCS#8 encrypted."
            rules={[
              { required: step === 0, message: "Bring the key, or skip it" },
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
            extra="Used to read it, never kept"
            rules={[{ required: step === 0, message: "Required" }]}
          >
            <Input.Password autoComplete="off" />
          </Form.Item>
        </div>
        <div hidden={step !== 1}>
          <Typography.Paragraph type="secondary">
            The CSR its certificate was issued from, if XCA kept one; skip it
            otherwise.
          </Typography.Paragraph>
          <Form.Item
            name="csr"
            label="Its CSR"
            extra="XCA: Certificate signing requests → Export, PEM."
          >
            <PemInput kind="csr" rows={4} />
          </Form.Item>
        </div>
        <div hidden={step !== 2}>
          <Form.Item
            name="certificate"
            label="Its certificate"
            extra="XCA: Certificates → the CA → Export, PEM. It fills in the rest."
            rules={[
              {
                required: step === 2,
                message: "Drop, choose or paste it",
              },
              {
                validator: (_, value?: string) => {
                  if (!value) return Promise.resolve();
                  const ca = readCaCertificate(value);
                  if (!ca?.ca) {
                    return Promise.reject(new Error("One CA certificate"));
                  }
                  if (ca.issuerName !== parentName) {
                    return Promise.reject(
                      new Error(
                        `Signed by ${ca.issuerName}, not ${parentName}`,
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
                { required: step === 2, message: "Required" },
                {
                  pattern: /^[a-z][a-z0-9-]{0,62}$/,
                  message: "Lower case, digits and hyphens",
                },
              ]}
            >
              <Input placeholder="xca-issuing-ca-1" />
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
          <Form.Item name="tier" label="Tier">
            <Radio.Group
              optionType="button"
              options={(["intermediate", "issuing"] as const).map((value) => ({
                value,
                label: TIERS[value],
              }))}
            />
          </Form.Item>
          {tier === "issuing" && (
            <>
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
                extra={
                  listsOnly
                    ? "Its certificate does not say path length 0, so it could sign a CA: it is imported closed, its key signing its lists only (ADR 0041)."
                    : "It signs its revocation lists and nothing new: XCA's CAs are imported closed (ADR 0037)."
                }
              >
                <Switch disabled={listsOnly} />
              </Form.Item>
            </>
          )}
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
