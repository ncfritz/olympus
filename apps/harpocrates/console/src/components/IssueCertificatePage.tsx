"use client";

import {
  Alert,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Switch,
  Tabs,
  Typography,
} from "antd";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { useIssuers, useProfiles } from "@/lib/api/queries";
import type {
  FullCertificate,
  KeyAlgorithm,
  KeyImportFormat,
  NameType,
  Profile,
} from "@/lib/api/types";
import {
  defaultAlgorithm,
  familyOf,
  KEY_FAMILIES,
  type KeyFamily,
} from "@/lib/keyTypes";
import { describeDays, ekuName, windowClosed } from "@/lib/labels";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "./ErrorAlert";
import { ImportKeyInput } from "./ImportKeyInput";
import { IssuedCertificate, type KeyOrigin } from "./IssuedCertificate";

const NAME_LABELS: Record<NameType, { label: string; placeholder: string }> = {
  dns: { label: "DNS names", placeholder: "host.internal.ncfritz.net" },
  ip: { label: "IP addresses", placeholder: "10.0.0.10" },
  email: { label: "Email addresses", placeholder: "neil@ncfritz.net" },
  uri: { label: "URIs", placeholder: "spiffe://ncfritz.net/service" },
  upn: { label: "User principal names", placeholder: "neil@ncfritz.net" },
  registeredId: { label: "Registered IDs (OIDs)", placeholder: "1.3.6.1.4.1…" },
};

/** The name types a profile's version allows, required ones first. */
const nameTypes = (profile: Profile): NameType[] =>
  [...profile.names]
    .sort((a, b) =>
      a.presence === b.presence ? 0 : a.presence === "required" ? -1 : 1,
    )
    .map((n) => n.type);

/** The extended usages a certificate gets unless asked otherwise. */
const issuedUsages = (profile: Profile): string[] =>
  profile.extendedKeyUsages
    .filter((u) => u.state === "forced" || u.state === "default")
    .map((u) => u.oid);

/** Where the key comes from: the key section's tabs. */
type Mode = "generated" | "imported" | "csr";

interface Values {
  profileId: string;
  issuerId?: string;
  commonName: string;
  organizationalUnit?: string;
  organization?: string;
  dns?: string[];
  ip?: string[];
  email?: string[];
  uri?: string[];
  upn?: string[];
  registeredId?: string[];
  mode: Mode;
  keyFamily?: KeyFamily;
  keyAlgorithm?: KeyAlgorithm;
  importFormat?: KeyImportFormat;
  keyData?: string;
  passphrase?: string;
  csr?: string;
  escrow?: boolean;
}

const modesOf = (profile: Profile | undefined): Mode[] =>
  profile
    ? [
        // A key brought in is kept as a generated one is.
        ...(profile.allowGenerated ? (["generated", "imported"] as const) : []),
        ...(profile.allowCsr ? (["csr"] as const) : []),
      ]
    : [];

/** The fields that start a profile's key section. */
const keyDefaults = (profile: Profile | undefined) => ({
  keyFamily: profile ? familyOf(profile.keyAlgorithm) : undefined,
  keyAlgorithm: profile?.keyAlgorithm,
  escrow: profile?.escrow,
});

/**
 * Issuing a certificate (ADR 0020, Profiles, amended): the profile decides
 * the usages, the validity, which names it takes and the default key type;
 * the operator gives the subject, the names, and the key: generated in
 * the signer (of any type), brought in, or the subscriber's CSR. The
 * service applies the profile's rules and the signer its invariants; a
 * refusal says which.
 */
export function IssueCertificatePage() {
  const { data: profiles } = useProfiles();
  const { data: issuers } = useIssuers();
  const { mutate } = useSWRConfig();
  const [form] = Form.useForm<Values>();
  const profileId = Form.useWatch("profileId", form);
  const mode = Form.useWatch("mode", form);
  const keyFamily = Form.useWatch("keyFamily", form);
  const keyAlgorithm = Form.useWatch("keyAlgorithm", form);
  const importFormat = Form.useWatch("importFormat", form);
  const issuable = useMemo(
    // A deactivated profile takes no new certificates (ADR 0034).
    () =>
      (profiles ?? []).filter(
        (profile) => !profile.directOnly && profile.active,
      ),
    [profiles],
  );
  const profile = issuable.find((p) => p.id === profileId);
  const modes = modesOf(profile);
  const candidates = (issuers ?? []).filter(
    (issuer) =>
      issuer.tier === "issuing" &&
      issuer.status === "active" &&
      !windowClosed(issuer) &&
      issuer.purpose === profile?.issuerPurpose,
  );
  const [issued, setIssued] = useState<{
    certificate: FullCertificate;
    keyOrigin: KeyOrigin;
    escrowed: boolean;
  }>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  const issue = async (values: Values) => {
    if (!profile) return;
    setBusy(true);
    try {
      const kept = values.mode !== "csr";
      const escrow = kept ? (values.escrow ?? profile.escrow) : undefined;
      const names = Object.fromEntries(
        nameTypes(profile)
          .map((type) => [type, values[type]] as const)
          .filter(([, list]) => list && list.length > 0),
      );
      const { certificate } = unwrap(
        await apiClient.POST("/v1/certificates", {
          body: {
            profileId: profile.id,
            issuerId: values.issuerId || undefined,
            subject: {
              commonName: values.commonName,
              organizationalUnit: values.organizationalUnit || undefined,
              organization: values.organization || undefined,
            },
            names: Object.keys(names).length ? names : undefined,
            csr: values.mode === "csr" ? values.csr : undefined,
            keyAlgorithm:
              values.mode === "generated" ? values.keyAlgorithm : undefined,
            key:
              values.mode === "imported"
                ? {
                    format: values.importFormat ?? "pem",
                    data: values.keyData ?? "",
                    passphrase: values.passphrase ?? "",
                  }
                : undefined,
            escrow,
          },
        }),
      );
      setIssued({
        certificate,
        keyOrigin: values.mode === "csr" ? "subscriber" : values.mode,
        escrowed: escrow ?? false,
      });
      setError(undefined);
      await mutate(
        (key) => typeof key === "string" && key.startsWith("/certificates"),
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Flex vertical gap="large">
      <Typography.Title level={3}>Issue a certificate</Typography.Title>
      {issued ? (
        <Card>
          <IssuedCertificate
            {...issued}
            actions={[
              <Button
                key="another"
                type="primary"
                onClick={() => {
                  setIssued(undefined);
                  form.resetFields();
                }}
              >
                Issue another
              </Button>,
              <Link key="all" href="/certificates">
                <Button>All certificates</Button>
              </Link>,
            ]}
          />
        </Card>
      ) : (
        <Card>
          <Form<Values>
            form={form}
            layout="vertical"
            onFinish={issue}
            initialValues={{ mode: "generated", importFormat: "pem" }}
            onValuesChange={(changed: Partial<Values>) => {
              // A family starts at its default size or curve.
              if (changed.keyFamily) {
                form.setFieldValue(
                  "keyAlgorithm",
                  defaultAlgorithm(changed.keyFamily, profile?.keyAlgorithm),
                );
              }
              // A PEM is not a PKCS#12 file.
              if (changed.importFormat) {
                form.setFieldValue("keyData", undefined);
              }
              // A profile brings its own enrollment modes, key type and
              // escrow setting.
              if (!changed.profileId) return;
              const chosen = issuable.find((p) => p.id === changed.profileId);
              const allowed = modesOf(chosen);
              form.setFieldsValue({
                issuerId: undefined,
                ...keyDefaults(chosen),
                mode: allowed.includes(form.getFieldValue("mode") as Mode)
                  ? (form.getFieldValue("mode") as Mode)
                  : allowed[0],
              });
            }}
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="profileId"
                  label="Profile"
                  rules={[{ required: true, message: "Choose a profile" }]}
                >
                  <Select
                    showSearch
                    placeholder="What it is for"
                    options={issuable.map((p) => ({
                      value: p.id,
                      label: `${p.id}: ${p.description}`,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="issuerId"
                  label="Issuer"
                  extra="By default the profile's: its pinned CA, or the active issuing CA of its purpose"
                >
                  <Select
                    allowClear
                    disabled={!profile}
                    placeholder={profile ? `A ${profile.issuerPurpose} CA` : ""}
                    options={candidates.map((issuer) => ({
                      value: issuer.id,
                      label: commonName(issuer.subject),
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>
            {profile && (
              <Alert
                type="info"
                showIcon
                title={profile.description}
                description={[
                  `${profile.keyAlgorithm} keys by default, valid ${describeDays(profile.validityDays)}, renewed at ${describeDays(profile.renewAtDays)}`,
                  issuedUsages(profile).length
                    ? `for ${issuedUsages(profile).map(ekuName).join(", ")}`
                    : undefined,
                  profile.minNames > 0
                    ? `it needs at least ${profile.minNames === 1 ? "one name" : `${profile.minNames} names`}`
                    : undefined,
                ]
                  .filter(Boolean)
                  .join("; ")}
              />
            )}
            {profile && candidates.length === 0 && (
              <Alert
                type="warning"
                showIcon
                title={`No active ${profile.issuerPurpose} issuing CA`}
                description="Create one in a ceremony before issuing under this profile."
              />
            )}
            {profile && (
              <>
                <Typography.Title level={5}>Subject</Typography.Title>
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="commonName"
                      label="Common name"
                      rules={[{ required: true, message: "Required" }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="organizationalUnit"
                      label="Organisational unit"
                    >
                      <Input allowClear />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="organization" label="Organisation">
                      <Input allowClear placeholder="The configured one" />
                    </Form.Item>
                  </Col>
                </Row>
                {nameTypes(profile).length > 0 && (
                  <>
                    <Typography.Title level={5}>Names</Typography.Title>
                    <Row gutter={16}>
                      {nameTypes(profile).map((type) => (
                        <Col key={type} xs={24} md={12}>
                          <Form.Item
                            name={type}
                            label={NAME_LABELS[type].label}
                          >
                            <Select
                              mode="tags"
                              open={false}
                              tokenSeparators={[",", " "]}
                              placeholder={NAME_LABELS[type].placeholder}
                            />
                          </Form.Item>
                        </Col>
                      ))}
                    </Row>
                  </>
                )}
                <Typography.Title level={5}>Key</Typography.Title>
                <Form.Item name="mode" hidden>
                  <Input />
                </Form.Item>
                <Tabs
                  activeKey={mode}
                  onChange={(key) => form.setFieldValue("mode", key as Mode)}
                  destroyOnHidden
                  items={[
                    {
                      key: "generated",
                      label: "Generate a new key",
                      disabled: !modes.includes("generated"),
                      children: (
                        <GenerateKeyFields
                          family={keyFamily}
                          algorithm={keyAlgorithm}
                        />
                      ),
                    },
                    {
                      key: "imported",
                      label: "Import a key",
                      disabled: !modes.includes("imported"),
                      children: (
                        <ImportKeyFields format={importFormat ?? "pem"} />
                      ),
                    },
                    {
                      key: "csr",
                      label: "From subscriber's CSR",
                      disabled: !modes.includes("csr"),
                      children: (
                        <Form.Item
                          name="csr"
                          label="CSR (PEM)"
                          extra="Any key type Harpocrates certifies: RSA or DSA of at least 2048 bits, P-256, P-384, P-521 or Ed25519"
                          rules={[
                            { required: true, message: "Paste the CSR" },
                            {
                              pattern: /-----BEGIN CERTIFICATE REQUEST-----/,
                              message: "A PEM certificate request",
                            },
                          ]}
                        >
                          <Input.TextArea rows={8} spellCheck={false} />
                        </Form.Item>
                      ),
                    },
                  ]}
                />
                {mode !== "csr" && (
                  <Form.Item
                    name="escrow"
                    label="Escrow the key"
                    valuePropName="checked"
                    extra={
                      !profile.escrowOverridable
                        ? "The profile decides"
                        : mode === "imported"
                          ? "Off: the signer forgets it once it is certified"
                          : "Off: it is exported once, then destroyed in the signer"
                    }
                  >
                    <Switch disabled={!profile.escrowOverridable} />
                  </Form.Item>
                )}
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={busy}
                  disabled={candidates.length === 0}
                >
                  Issue
                </Button>
              </>
            )}
          </Form>
        </Card>
      )}
      <ErrorAlert error={error} />
    </Flex>
  );
}

/** The generate tab: the key's type, then its size or curve. */
function GenerateKeyFields({
  family,
  algorithm,
}: {
  family?: KeyFamily;
  algorithm?: KeyAlgorithm;
}) {
  const chosen = KEY_FAMILIES.find((f) => f.family === family);
  return (
    <>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="keyFamily"
            label="Key type"
            rules={[{ required: true, message: "Choose a key type" }]}
          >
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={KEY_FAMILIES.map((f) => ({
                value: f.family,
                label: f.label,
              }))}
            />
          </Form.Item>
        </Col>
        {chosen?.choice && (
          <Col xs={24} md={12}>
            <Form.Item
              name="keyAlgorithm"
              label={chosen.choice}
              rules={[{ required: true, message: "Required" }]}
            >
              <Select options={chosen.algorithms} />
            </Form.Item>
          </Col>
        )}
      </Row>
      {family === "DSA" && (
        <Form.Item>
          <Alert
            type="warning"
            showIcon
            title="Few clients still take DSA"
            description="TLS 1.3 has no DSA, and browsers and current OpenSSL refuse DSA certificates: use it only for a client that needs it."
          />
        </Form.Item>
      )}
      {algorithm === "RSA-8192" && (
        <Form.Item>
          <Alert
            type="info"
            showIcon
            title="An 8192-bit key takes a while"
            description="The signer may take up to a minute to generate it."
          />
        </Form.Item>
      )}
    </>
  );
}

/** The import tab: the key's file and its passphrase. */
function ImportKeyFields({ format }: { format: KeyImportFormat }) {
  return (
    <>
      <Form.Item name="importFormat" label="Format">
        <Radio.Group
          options={[
            { value: "pem", label: "Encrypted PKCS#8 (PEM)" },
            { value: "pkcs12", label: "PKCS#12 (.p12, .pfx)" },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="keyData"
        label={format === "pkcs12" ? "File" : "Key"}
        extra={
          format === "pkcs12"
            ? "Only its key is used: the certificates in it are not kept"
            : undefined
        }
        rules={[
          { required: true, message: "Bring the key" },
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
      <Row>
        <Col xs={24} md={12}>
          <Form.Item
            name="passphrase"
            label="Passphrase"
            extra="Used once to read it, never kept"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input.Password autoComplete="off" />
          </Form.Item>
        </Col>
      </Row>
    </>
  );
}
