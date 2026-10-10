"use client";

import { DownloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Flex,
  Form,
  Input,
  InputNumber,
  Result,
  Row,
  Select,
  Switch,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { useProfiles } from "@/lib/api/queries";
import type { FullCertificate } from "@/lib/api/types";
import { saveFile } from "@/lib/download";
import { describeDays, formatDate } from "@/lib/labels";
import { ErrorAlert } from "./ErrorAlert";
import { KeyExportForm } from "./KeyExportForm";

interface Values {
  profileId: string;
  commonName: string;
  organizationalUnit?: string;
  organization?: string;
  validityDays?: number;
  escrow?: boolean;
}

/**
 * Leaves a root signs directly, in its ceremony (ADR 0032, Three shapes):
 * the signer generates each key, the root signs, and the certificate
 * carries exactly what its profile names (for the bespoke root, the key
 * identifiers and nothing else). The key is escrowed by default.
 */
export function CeremonyLeafPanel({
  ceremonyId,
  organization,
}: {
  ceremonyId: string;
  organization?: string;
}) {
  const { data: profiles } = useProfiles();
  const { mutate } = useSWRConfig();
  const [form] = Form.useForm<Values>();
  const direct = useMemo(
    () => (profiles ?? []).filter((profile) => profile.directOnly),
    [profiles],
  );
  const profileId = Form.useWatch("profileId", form);
  const profile = direct.find((p) => p.id === profileId) ?? direct[0];
  const [made, setMade] = useState<{
    certificate: FullCertificate;
    escrowed: boolean;
  }>();
  const [exported, setExported] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  const sign = async (values: Values) => {
    setBusy(true);
    try {
      const escrow = values.escrow ?? profile?.escrow ?? true;
      const { certificate } = unwrap(
        await apiClient.POST("/v1/ceremony/{ceremonyId}/certificates", {
          params: { path: { ceremonyId } },
          body: {
            profileId: values.profileId,
            subject: {
              commonName: values.commonName,
              organizationalUnit: values.organizationalUnit || undefined,
              organization: values.organization || undefined,
            },
            validityDays: values.validityDays ?? undefined,
            escrow,
          },
        }),
      );
      setMade({ certificate, escrowed: escrow });
      setExported(false);
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

  if (!profiles) return null;
  if (direct.length === 0) {
    return (
      <Alert
        type="warning"
        showIcon
        title="No profile is for a root that signs directly"
      />
    );
  }

  if (made) {
    const { certificate, escrowed } = made;
    return (
      <Flex vertical gap="large">
        <Result
          status="success"
          title="Signed"
          subTitle={certificate.subject}
          extra={[
            <Button
              key="pem"
              icon={<DownloadOutlined />}
              onClick={() =>
                saveFile(
                  `${certificate.serial}.crt.pem`,
                  certificate.certificate,
                  "application/x-pem-file",
                )
              }
            >
              Save the certificate
            </Button>,
            <Button
              key="another"
              type="primary"
              disabled={!escrowed && !exported}
              onClick={() => setMade(undefined)}
            >
              Sign another
            </Button>,
          ]}
        />
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Serial">
            {certificate.serial}
          </Descriptions.Item>
          <Descriptions.Item label="Valid until">
            {formatDate(certificate.notAfter)}
          </Descriptions.Item>
          <Descriptions.Item label="Key">
            {escrowed
              ? "Escrowed: export it from Certificates when it is needed"
              : exported
                ? "Exported, and destroyed in the signer"
                : "Not escrowed: export it now, once"}
          </Descriptions.Item>
        </Descriptions>
        {!escrowed && !exported && (
          <KeyExportForm
            certificateId={certificate.id}
            exportOnce
            onExported={() => setExported(true)}
          />
        )}
      </Flex>
    );
  }

  return (
    <Form<Values>
      form={form}
      layout="vertical"
      initialValues={{ profileId: direct[0].id, escrow: direct[0].escrow }}
      // A profile brings its own escrow setting.
      onValuesChange={(changed: Partial<Values>) => {
        const chosen = direct.find((p) => p.id === changed.profileId);
        if (chosen) form.setFieldValue("escrow", chosen.escrow);
      }}
      onFinish={sign}
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="profileId" label="Profile">
            <Select
              options={direct.map((p) => ({ value: p.id, label: p.id }))}
            />
          </Form.Item>
          {profile && (
            <Typography.Paragraph type="secondary">
              {profile.description}. {profile.keyAlgorithm},{" "}
              {describeDays(profile.validityDays)};{" "}
              {profile.extensions === "minimal"
                ? "carries the subject and authority key identifiers and no other extension."
                : "carries the extensions its rules make."}
            </Typography.Paragraph>
          )}
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="escrow"
            label="Escrow the key"
            valuePropName="checked"
            extra={
              profile?.escrowOverridable
                ? "Off: the key is exported once, then destroyed"
                : "The profile decides"
            }
          >
            <Switch disabled={!profile?.escrowOverridable} />
          </Form.Item>
        </Col>
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
          <Form.Item name="organizationalUnit" label="Organisational unit">
            <Input allowClear />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="organization" label="Organisation">
            <Input allowClear placeholder={organization ?? "The root's"} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="validityDays" label="Validity (days)">
            <InputNumber
              min={1}
              placeholder={String(profile?.validityDays ?? "")}
            />
          </Form.Item>
        </Col>
      </Row>
      <Button type="primary" htmlType="submit" loading={busy}>
        Generate and sign
      </Button>
      <ErrorAlert error={error} />
    </Form>
  );
}
