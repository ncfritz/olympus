"use client";

import {
  Col,
  Collapse,
  Flex,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Spin,
  Switch,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type {
  PreviewIssuerRequest,
  PreviewIssuerResponse,
} from "@/lib/api/types";
import { type CaFormValues, type CaTarget, caRequestOf } from "@/lib/caRequest";
import { EKU_NAMES } from "@/lib/labels";
import { ErrorAlert } from "./ErrorAlert";
import { SettingsReview } from "./SettingsReview";

/** How long the form rests before it is previewed again. */
const PREVIEW_DELAY_MS = 300;

const PURPOSE_PATTERN = /^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/;

const EKU_OPTIONS = Object.entries(EKU_NAMES).map(([value, label]) => ({
  value,
  label: `${label} (${value})`,
}));

export interface CaSettingsProps {
  target: CaTarget;
  /** The parts to start from: the operator chooses the names (ADR 0032). */
  initialValues?: CaFormValues;
  /** Purposes to suggest; an issuing CA must have one. */
  purposes?: string[];
  /** The request as reviewed, and its preview, whenever either changes. */
  onReviewed: (
    request: PreviewIssuerRequest,
    answer: PreviewIssuerResponse | undefined,
  ) => void;
}

/**
 * A new CA's name and settings, and the review of them beside their
 * defaults (ADR 0032, Names and settings): every change is previewed by
 * the service, which builds the subject and checks it exactly as creating
 * the CA would. Nothing is signed here.
 */
export function CaSettings({
  target,
  initialValues,
  purposes = [],
  onReviewed,
}: CaSettingsProps) {
  const [form] = Form.useForm<CaFormValues>();
  const values = Form.useWatch([], { form, preserve: true }) as
    CaFormValues | undefined;
  const request = useMemo(
    () => caRequestOf(target, { ...initialValues, ...values }),
    [target, initialValues, values],
  );
  const [answer, setAnswer] = useState<PreviewIssuerResponse>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(request);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const previewed = unwrap(
          await apiClient.POST("/v1/issuers/preview", { body: request }),
        );
        if (!current) return;
        setAnswer(previewed);
        setError(undefined);
        onReviewed(request, previewed);
      } catch (failure) {
        if (!current) return;
        setError(failure);
        onReviewed(request, undefined);
      } finally {
        if (current) setLoading(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
    // The request's content, not its identity, decides a new preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const customSubject = Form.useWatch("customSubject", form);
  const defaults = answer?.defaults;

  return (
    <Flex vertical gap="large">
      <Form<CaFormValues>
        form={form}
        layout="vertical"
        initialValues={{ number: 1, generation: 1, ...initialValues }}
      >
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item
              name="organization"
              label="Organisation"
              tooltip="O, and the start of the CN"
            >
              <Input placeholder={defaults?.organization} allowClear />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="purpose"
              label="Purpose"
              tooltip={
                target.tier === "issuing"
                  ? "What it issues for: its profiles name it"
                  : "Optional, in its name: Dev, Servers"
              }
              rules={[
                {
                  required: target.tier === "issuing",
                  message: "An issuing CA needs a purpose",
                },
                {
                  pattern: PURPOSE_PATTERN,
                  message: "Capitalised words: Dev, Servers, TLS",
                },
              ]}
            >
              {purposes.length > 0 ? (
                <Select
                  allowClear
                  showSearch
                  options={purposes.map((purpose) => ({
                    value: purpose,
                    label: purpose,
                  }))}
                />
              ) : (
                <Input allowClear />
              )}
            </Form.Item>
          </Col>
          <Col xs={12} md={4}>
            <Form.Item
              name="number"
              label="Number"
              tooltip="Tells apart CAs of the same purpose and tier"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} />
            </Form.Item>
          </Col>
          <Col xs={12} md={4}>
            <Form.Item
              name="generation"
              label="Generation"
              tooltip="1, unless it succeeds a CA"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} />
            </Form.Item>
          </Col>
        </Row>
        <Collapse
          size="small"
          items={[
            {
              key: "advanced",
              label: "Change other settings",
              children: (
                <>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="customSubject"
                        label="Write the subject outright"
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                      {customSubject && (
                        <Form.Item
                          name="subject"
                          label="Subject (RFC 4514)"
                          rules={[
                            { required: true },
                            { pattern: /(^|,)CN=/, message: "It needs a CN" },
                          ]}
                        >
                          <Input placeholder={defaults?.subject} />
                        </Form.Item>
                      )}
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item name="validityDays" label="Validity (days)">
                        <InputNumber
                          min={1}
                          max={36500}
                          placeholder={String(defaults?.validityDays ?? "")}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item name="algorithm" label="Key">
                        <Select
                          allowClear
                          placeholder={defaults?.algorithm}
                          options={[
                            { value: "P-256", label: "P-256 (EC)" },
                            { value: "RSA-2048", label: "RSA 2048" },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  {target.tier === "issuing" && (
                    <Row gutter={16}>
                      <Col xs={24} md={16}>
                        <Form.Item
                          name="extendedKeyUsages"
                          label="Extended key usages it signs"
                        >
                          <Select
                            mode="tags"
                            options={EKU_OPTIONS}
                            placeholder="Its purpose's profiles'"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item
                          name="maxValidityDays"
                          label="Longest certificate (days)"
                        >
                          <InputNumber
                            min={1}
                            max={3650}
                            placeholder={String(
                              defaults?.maxValidityDays ?? "",
                            )}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  )}
                  <Typography.Text strong>Name constraints</Typography.Text>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="permittedDns" label="Permitted DNS">
                        <Select mode="tags" placeholder="dev.ncfritz.net" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="excludedDns" label="Excluded DNS">
                        <Select mode="tags" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="permittedEmail" label="Permitted email">
                        <Select mode="tags" placeholder="ncfritz.net" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="permittedIp" label="Permitted IP">
                        <Select mode="tags" placeholder="10.0.0.0/8" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="excludedIp" label="Excluded IP">
                        <Select mode="tags" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ),
            },
          ]}
        />
      </Form>
      <ErrorAlert error={error} title="The preview failed" />
      <Spin spinning={loading && !answer}>
        {answer && (
          <SettingsReview
            tier={target.tier}
            answer={answer}
            onReset={(fields) =>
              form.setFieldsValue(
                Object.fromEntries(fields.map((field) => [field, undefined])),
              )
            }
          />
        )}
      </Spin>
    </Flex>
  );
}
