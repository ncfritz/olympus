"use client";

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  Form,
  Radio,
  Steps,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS } from "@/lib/api/queries";
import type {
  IssuerShape,
  PreviewIssuerRequest,
  PreviewIssuerResponse,
} from "@/lib/api/types";
import { createBodyOf } from "@/lib/caRequest";
import { describeDays, SHAPES } from "@/lib/labels";
import { useLeaveWarning } from "@/lib/useLeaveWarning";
import { CaSettings } from "./CaSettings";
import { ErrorAlert } from "./ErrorAlert";
import { KeyHandover } from "./KeyHandover";
import { PassphraseFields } from "./PassphraseFields";

const STEPS = [
  { title: "Shape" },
  { title: "Name and settings" },
  { title: "Create" },
  { title: "Take the key" },
];

/**
 * A new root (ADR 0032, Bootstrap and a new root): its shape; its name
 * and settings, reviewed beside their defaults; the passphrase its key
 * leaves under; and the key itself, handed over once. Its first ceremony,
 * from the CA's page, proves the backup.
 */
export function NewRootPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [step, setStep] = useState(0);
  const [shape, setShape] = useState<IssuerShape>("three_tier");
  const [reviewed, setReviewed] = useState<{
    request: PreviewIssuerRequest;
    answer?: PreviewIssuerResponse;
  }>();
  const [created, setCreated] = useState<{ id: string; key: string }>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  useLeaveWarning(Boolean(created));
  // One object per shape: CaSettings previews again when it changes.
  const target = useMemo(() => ({ tier: "root" as const, shape }), [shape]);

  const ready =
    reviewed?.answer !== undefined && reviewed.answer.problems.length === 0;

  const create = async ({ passphrase }: { passphrase: string }) => {
    if (!reviewed) return;
    setBusy(true);
    try {
      const answer = unwrap(
        await apiClient.POST("/v1/issuers/roots", {
          body: {
            ...createBodyOf(reviewed.request),
            number: reviewed.request.number,
            generation: reviewed.request.generation,
            shape,
            exportPassphrase: passphrase,
          },
        }),
      );
      setCreated({ id: answer.issuer.id, key: answer.encryptedKey });
      setError(undefined);
      setStep(3);
      await mutate(KEYS.issuers);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Flex vertical gap="large">
      <Typography.Title level={3}>New root</Typography.Title>
      <Steps current={step} items={STEPS} />

      {step === 0 && (
        <Card title="What will it sign?">
          <Flex vertical gap="middle">
            <Radio.Group
              value={shape}
              onChange={(event) => setShape(event.target.value as IssuerShape)}
            >
              <Flex vertical gap="middle">
                {(Object.keys(SHAPES) as IssuerShape[]).map((key) => (
                  <Radio key={key} value={key}>
                    <Typography.Text strong>
                      {SHAPES[key].label}
                    </Typography.Text>
                    <br />
                    <Typography.Text type="secondary">
                      {SHAPES[key].summary}
                    </Typography.Text>
                  </Radio>
                ))}
              </Flex>
            </Radio.Group>
            <div>
              <Button type="primary" onClick={() => setStep(1)}>
                Next
              </Button>
            </div>
          </Flex>
        </Card>
      )}

      {/* Kept mounted through the later steps, so Back keeps the form. */}
      <div hidden={step !== 1}>
        <Card title="Name and settings">
          <Flex vertical gap="large">
            <Typography.Text type="secondary">
              Every setting starts at its recommended default. Change any of
              them; the review below shows what will be signed, beside the
              default and why it is the default.
            </Typography.Text>
            <CaSettings
              target={target}
              onReviewed={(request, answer) => setReviewed({ request, answer })}
            />
            <Flex gap="small">
              <Button onClick={() => setStep(0)}>Back</Button>
              <Button
                type="primary"
                disabled={!ready}
                onClick={() => setStep(2)}
              >
                Next
              </Button>
            </Flex>
          </Flex>
        </Card>
      </div>

      {step === 2 && reviewed?.answer && (
        <Card title="Create the root">
          <Flex vertical gap="large">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Subject">
                <Typography.Text code>
                  {reviewed.answer.preview.subject}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Shape">
                {SHAPES[shape].label}
              </Descriptions.Item>
              <Descriptions.Item label="Validity">
                {describeDays(reviewed.answer.preview.validityDays)}
              </Descriptions.Item>
              <Descriptions.Item label="Key">
                {reviewed.answer.preview.algorithm}
              </Descriptions.Item>
            </Descriptions>
            <Alert
              type="info"
              showIcon
              title="The signer generates the key and gives it back once"
              description="It is encrypted under the passphrase below and Harpocrates keeps no copy. Choose the passphrase now and put it in the password manager; the key file goes on offline media in the next step."
            />
            <Form<{ passphrase: string }> layout="vertical" onFinish={create}>
              <PassphraseFields
                label="Export passphrase"
                extra="Opens the key file at every ceremony"
              />
              <Flex gap="small">
                <Button onClick={() => setStep(1)}>Back</Button>
                <Button type="primary" htmlType="submit" loading={busy}>
                  Create root
                </Button>
              </Flex>
            </Form>
            <ErrorAlert error={error} />
          </Flex>
        </Card>
      )}

      {step === 3 && created && (
        <Card title="Take the key">
          <KeyHandover
            issuerId={created.id}
            encryptedKey={created.key}
            doneLabel="Next: prove the backup"
            onDone={() => router.push(`/ceremonies/new?issuerId=${created.id}`)}
          />
        </Card>
      )}
    </Flex>
  );
}
