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
  Typography,
} from "antd";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { useIssuers, useProfiles } from "@/lib/api/queries";
import type { FullCertificate, NameType, Profile } from "@/lib/api/types";
import { describeDays, ekuName, windowClosed } from "@/lib/labels";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "./ErrorAlert";
import { IssuedCertificate } from "./IssuedCertificate";

const NAME_LABELS: Record<NameType, { label: string; placeholder: string }> = {
  dns: { label: "DNS names", placeholder: "host.internal.ncfritz.net" },
  ip: { label: "IP addresses", placeholder: "10.0.0.10" },
  email: { label: "Email addresses", placeholder: "neil@ncfritz.net" },
  uri: { label: "URIs", placeholder: "spiffe://ncfritz.net/service" },
};

type Mode = "generated" | "csr";

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
  mode: Mode;
  csr?: string;
  escrow?: boolean;
}

const modesOf = (profile: Profile | undefined): Mode[] =>
  profile
    ? [
        ...(profile.allowGenerated ? (["generated"] as const) : []),
        ...(profile.allowCsr ? (["csr"] as const) : []),
      ]
    : [];

/**
 * Issuing a certificate (ADR 0020, Profiles): the profile decides the key,
 * the usages, the validity and which names it takes; the operator gives
 * the subject, the names, and either a CSR or a key for the signer to
 * generate. The service applies the profile's rules and the signer its
 * invariants; a refusal says which.
 */
export function IssueCertificatePage() {
  const { data: profiles } = useProfiles();
  const { data: issuers } = useIssuers();
  const { mutate } = useSWRConfig();
  const [form] = Form.useForm<Values>();
  const profileId = Form.useWatch("profileId", form);
  const mode = Form.useWatch("mode", form);
  const issuable = useMemo(
    () => (profiles ?? []).filter((profile) => !profile.directOnly),
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
    generated: boolean;
    escrowed: boolean;
  }>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  const issue = async (values: Values) => {
    if (!profile) return;
    setBusy(true);
    try {
      const generated = values.mode === "generated";
      const escrow = generated ? (values.escrow ?? profile.escrow) : undefined;
      const names = Object.fromEntries(
        profile.nameTypes
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
            csr: generated ? undefined : values.csr,
            escrow,
          },
        }),
      );
      setIssued({ certificate, generated, escrowed: escrow ?? false });
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
            initialValues={{ mode: "generated" }}
            // A profile brings its own enrollment modes and escrow setting.
            onValuesChange={(changed: Partial<Values>) => {
              if (!changed.profileId) return;
              const chosen = issuable.find((p) => p.id === changed.profileId);
              const allowed = modesOf(chosen);
              form.setFieldsValue({
                issuerId: undefined,
                escrow: chosen?.escrow,
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
                  `${profile.keyAlgorithm}, valid ${describeDays(profile.validityDays)}, renewed at ${describeDays(profile.renewAtDays)}`,
                  profile.extendedKeyUsages.length
                    ? `for ${profile.extendedKeyUsages.map(ekuName).join(", ")}`
                    : undefined,
                  profile.requireSan ? "it needs at least one name" : undefined,
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
                {profile.nameTypes.length > 0 && (
                  <>
                    <Typography.Title level={5}>Names</Typography.Title>
                    <Row gutter={16}>
                      {profile.nameTypes.map((type) => (
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
                <Form.Item name="mode">
                  <Radio.Group>
                    <Radio
                      value="generated"
                      disabled={!modes.includes("generated")}
                    >
                      Generate it in the signer
                    </Radio>
                    <Radio value="csr" disabled={!modes.includes("csr")}>
                      From the subscriber&apos;s CSR
                    </Radio>
                  </Radio.Group>
                </Form.Item>
                {mode === "csr" && (
                  <Form.Item
                    name="csr"
                    label="CSR (PEM)"
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
                )}
                {mode === "generated" && (
                  <Form.Item
                    name="escrow"
                    label="Escrow the key"
                    valuePropName="checked"
                    extra={
                      profile.escrowOverridable
                        ? "Off: it is exported once, then destroyed in the signer"
                        : "The profile decides"
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
