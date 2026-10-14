"use client";

import {
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Spin,
  Steps,
  Table,
  Typography,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type {
  IssuerShape,
  PreviewIssuerRequest,
  PreviewIssuerResponse,
} from "@/lib/api/types";
import {
  CA_KEY_FAMILIES,
  caFamilyOf,
  commonNameStemOf,
  ROOT_SUBJECT_ATTRIBUTES,
  type RootDefaults,
  type RootFormValues,
  rootRequestOf,
} from "@/lib/rootRequest";
import { ErrorAlert } from "../ErrorAlert";
import {
  type ReviewGroup,
  type ReviewRow,
  ReviewProblems,
  reviewRowsOf,
} from "../SettingsReview";
import { ConstraintList } from "./ConstraintList";
import styles from "./RootSettings.module.css";

/** How long the form rests before it is previewed again. */
const PREVIEW_DELAY_MS = 300;

const PURPOSE_PATTERN = /^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/;

const GROUPS: { group: ReviewGroup; title: string }[] = [
  { group: "key", title: "Key" },
  { group: "name", title: "Name" },
  { group: "constraints", title: "Name constraints" },
  { group: "details", title: "Details" },
];

/** What the service would build without the form, from its last preview. */
const defaultsOf = (
  answer: PreviewIssuerResponse | undefined,
): RootDefaults | undefined =>
  answer && {
    algorithm: answer.defaults.algorithm,
    commonName: commonNameStemOf(answer.defaults.subject) ?? "",
    organization: answer.defaults.organization,
  };

/**
 * The review: each setting's value and why, grouped as the form is.
 * Nothing is marked changed or fixed; what is not a setting is still
 * listed, so the review is of the whole certificate.
 */
function RootReview({ answer }: { answer: PreviewIssuerResponse }) {
  const rows = reviewRowsOf("root", answer).map((row) =>
    row.key === "subject"
      ? {
          ...row,
          why: "Its common name, with its number and generation appended, and its other attributes. A subject is never used twice.",
        }
      : row,
  );
  return (
    <Flex vertical gap="large">
      <ReviewProblems problems={answer.problems} />
      {GROUPS.map(({ group, title }) => (
        <Flex key={group} vertical gap="small">
          <Typography.Title level={5} className={styles.reviewTitle}>
            {title}
          </Typography.Title>
          <Table<ReviewRow>
            size="small"
            pagination={false}
            rowKey="key"
            dataSource={rows.filter((row) => row.group === group)}
            columns={[
              {
                title: "Setting",
                dataIndex: "setting",
                width: "22%",
                render: (setting: string) => (
                  <Typography.Text strong>{setting}</Typography.Text>
                ),
              },
              { title: "Value", dataIndex: "value", width: "38%" },
              {
                title: "Why",
                dataIndex: "why",
                render: (why: string) => (
                  <Typography.Text type="secondary">{why}</Typography.Text>
                ),
              },
            ]}
          />
        </Flex>
      ))}
    </Flex>
  );
}

/**
 * A new root's name and settings (ADR 0032, Names and settings), in four
 * steps down the page: its key, its name, its name constraints, and the
 * review of all of it. Every change is previewed by the service, which
 * builds the subject and checks it exactly as creating the root would;
 * nothing is signed here.
 */
export function RootSettings({
  shape,
  onReviewed,
}: {
  shape: IssuerShape;
  /** The request as reviewed, and its preview, whenever either changes. */
  onReviewed: (
    request: PreviewIssuerRequest,
    answer: PreviewIssuerResponse | undefined,
  ) => void;
}) {
  const [form] = Form.useForm<RootFormValues>();
  const values = Form.useWatch([], { form, preserve: true }) as
    RootFormValues | undefined;
  const [answer, setAnswer] = useState<PreviewIssuerResponse>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  const defaults = useMemo(() => defaultsOf(answer), [answer]);
  const request = useMemo(
    () => rootRequestOf(shape, values ?? {}, defaults),
    [shape, values, defaults],
  );
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

  // The first preview fills in what the service would build, so the form
  // starts from it: the key, the common name, the organisation.
  const filled = useRef(false);
  useEffect(() => {
    if (!defaults || filled.current) return;
    filled.current = true;
    form.setFieldsValue({
      keyFamily: caFamilyOf(defaults.algorithm),
      algorithm: defaults.algorithm,
      commonName: defaults.commonName,
      attributes: { O: defaults.organization },
    });
  }, [defaults, form]);

  const family = CA_KEY_FAMILIES.find((f) => f.family === values?.keyFamily);
  const numbering = `${values?.number ?? 1} - G${values?.generation ?? 1}`;
  const named = Boolean(values?.commonName?.trim());

  const key_ = (
    <Row gutter={16}>
      <Col xs={24} md={8}>
        <Form.Item
          name="keyFamily"
          label="Key type"
          tooltip="EC keys are small and fast, and every client here takes them; RSA for a relying party that needs it"
        >
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={CA_KEY_FAMILIES.map((f) => ({
              value: f.family,
              label: f.label,
            }))}
          />
        </Form.Item>
      </Col>
      {family?.choice && (
        <Col xs={24} md={8}>
          <Form.Item
            name="algorithm"
            label={family.choice}
            tooltip={
              family.family === "EC"
                ? "The curve its key is on: a CA's key is P-256 (ADR 0033)"
                : "Its key's size: a CA's RSA key is 2048 bits (ADR 0033)"
            }
          >
            <Select options={family.algorithms} />
          </Form.Item>
        </Col>
      )}
      <Col xs={24} md={8}>
        <Form.Item
          name="validityDays"
          label="Validity"
          tooltip="How long the root is valid: 20 years by default, since every device trusts it by hand and it is replaced rarely"
        >
          <InputNumber
            min={1}
            max={36500}
            suffix="days"
            className={styles.number}
            placeholder={String(answer?.defaults.validityDays ?? "")}
          />
        </Form.Item>
      </Col>
    </Row>
  );

  const name = (
    <Flex vertical>
      <Row gutter={16}>
        <Col xs={24} md={10}>
          <Form.Item
            name="commonName"
            label="Common name"
            tooltip="The CN: its number and generation are added to the end"
            rules={[
              { required: true, whitespace: true, message: "Required" },
              {
                pattern: /^[^,=+<>#;"\\]{1,48}$/,
                message:
                  'At most 48 characters, and none of , = + < > # ; " \\',
              },
            ]}
          >
            <Input
              className={styles.mono}
              suffix={<span className={styles.numbering}>{numbering}</span>}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item
            name="purpose"
            label="Purpose"
            tooltip="Optional: what the root is for, in its ID (dev-root-1-g1) and its URLs. Capitalised words: Dev, Servers"
            rules={[
              {
                pattern: PURPOSE_PATTERN,
                message: "Capitalised words: Dev, Servers",
              },
            ]}
          >
            <Input allowClear />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item
            name="number"
            label="Number"
            tooltip="Tells apart roots of the same purpose: 1 for the first"
            rules={[{ required: true, message: "Required" }]}
          >
            <InputNumber min={1} className={styles.number} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item
            name="generation"
            label="Generation"
            tooltip="1, unless it succeeds a root: its successor keeps the number and counts up the generation"
            rules={[{ required: true, message: "Required" }]}
          >
            <InputNumber min={1} className={styles.number} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        {ROOT_SUBJECT_ATTRIBUTES.map((a) => (
          <Col key={a.type} xs={24} md={8}>
            <Form.Item
              name={["attributes", a.type]}
              label={a.label}
              tooltip={`${a.type}: ${a.help}`}
              rules={
                a.type === "C"
                  ? [{ pattern: /^[A-Z]{2}$/, message: "Two capital letters" }]
                  : a.type === "emailAddress"
                    ? [{ type: "email", message: "An email address" }]
                    : [{ max: 64, message: "At most 64 characters" }]
              }
            >
              <Input allowClear maxLength={a.type === "C" ? 2 : undefined} />
            </Form.Item>
          </Col>
        ))}
      </Row>
      <Flex vertical gap={4}>
        <Typography.Text type="secondary">Its subject</Typography.Text>
        <div className={styles.dn} aria-live="polite">
          {answer?.preview.subject ?? "…"}
        </div>
      </Flex>
    </Flex>
  );

  const constraints = (
    <div className={styles.constraintColumns}>
      <Form.Item
        name="permitted"
        label="Permitted"
        tooltip="Names everything beneath this root must fall within. None: any name"
      >
        <ConstraintList label="Permitted" />
      </Form.Item>
      <Form.Item
        name="excluded"
        label="Excluded"
        tooltip="Names nothing beneath this root may have, even within those permitted"
      >
        <ConstraintList label="Excluded" />
      </Form.Item>
    </div>
  );

  return (
    <Form<RootFormValues>
      form={form}
      layout="vertical"
      initialValues={{ number: 1, generation: 1 }}
      className={styles.form}
      onValuesChange={(changed: RootFormValues) => {
        // A family starts at its first size or curve.
        if (changed.keyFamily) {
          form.setFieldValue(
            "algorithm",
            CA_KEY_FAMILIES.find((f) => f.family === changed.keyFamily)!
              .algorithms[0].value,
          );
        }
      }}
    >
      <Steps
        orientation="vertical"
        type="dot"
        current={named ? 3 : 1}
        className={styles.steps}
        items={[
          { title: "Key", content: key_ },
          { title: "Name", content: name },
          { title: "Name constraints", content: constraints },
          {
            title: "Review",
            content: (
              <Flex vertical gap="middle">
                <ErrorAlert error={error} title="The preview failed" />
                <Spin spinning={loading && !answer}>
                  {answer ? <RootReview answer={answer} /> : <div />}
                </Spin>
              </Flex>
            ),
          },
        ]}
      />
    </Form>
  );
}
