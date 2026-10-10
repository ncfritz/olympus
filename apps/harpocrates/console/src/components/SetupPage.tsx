"use client";

import { CheckCircleOutlined, DownloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Flex,
  Form,
  Result,
  Spin,
  Steps,
  Table,
  Typography,
} from "antd";
import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS, useCurrentUser, useSignerStatus } from "@/lib/api/queries";
import { saveFile } from "@/lib/download";
import { useLeaveWarning } from "@/lib/useLeaveWarning";
import { ErrorAlert } from "./ErrorAlert";
import { PassphraseFields } from "./PassphraseFields";

const STEPS = [
  { title: "Recovery passphrase" },
  { title: "Unseal key" },
  { title: "Restart" },
  { title: "First root" },
];

const SECRET = "harpocrates_signer_unseal_key";

const CHECKLIST = [
  "The unseal key is in the password manager, beside the recovery passphrase",
  `It is in \${SECRETS_DIR}/${SECRET}, mode 600`,
  "It is not in the same backup as the signer's data directory",
];

/** Who holds what, once the signer is set up (ADR 0020, Key protection). */
const SECRETS = [
  {
    key: "passphrase",
    secret: "Recovery passphrase",
    where: "The password manager",
    opens: "The signer, after a deliberate seal or without its unseal key",
  },
  {
    key: "unseal",
    secret: "Unseal key",
    where: `\${SECRETS_DIR}/${SECRET}, and the password manager`,
    opens: "The signer, by itself, at every start",
  },
  {
    key: "keys",
    secret: "Offline CA key files",
    where:
      "Offline media, two copies; their passphrases in the password manager",
    opens: "A ceremony with that CA",
  },
];

/**
 * The signer's first run (ADR 0032, Bootstrap): the recovery passphrase,
 * the unseal key shown once, the restart that proves it unseals itself,
 * and on to the first root.
 */
export function SetupPage() {
  // Quicker than elsewhere: the restart step watches it come back.
  const { data: status, error: unreachable } = useSignerStatus(3_000);
  const { isAdmin } = useCurrentUser();
  const { mutate } = useSWRConfig();
  const [step, setStep] = useState(0);
  const [unsealKey, setUnsealKey] = useState<string>();
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  useLeaveWarning(step === 1);
  // Initialising leaves the signer unsealed: only coming back unsealed
  // after being gone (or sealed) shows the unseal key at work.
  const [wentAway, setWentAway] = useState(false);
  const away = step === 2 && (Boolean(unreachable) || status?.sealed === true);
  if (away && !wentAway) setWentAway(true);

  if (!status) return <Spin />;
  if (status.initialised && step === 0) {
    return (
      <Result
        status="success"
        title="The signer is set up"
        extra={
          <Link href="/roots">
            <Button type="primary">Roots</Button>
          </Link>
        }
      />
    );
  }

  const initialise = async ({ passphrase }: { passphrase: string }) => {
    setBusy(true);
    try {
      const answer = unwrap(
        await apiClient.POST("/v1/signer/initialise", { body: { passphrase } }),
      );
      setUnsealKey(answer.unsealKey);
      setError(undefined);
      setStep(1);
      await mutate(KEYS.signer);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const restarted =
    wentAway && !unreachable && status.initialised && !status.sealed;

  return (
    <Flex vertical gap="large">
      <Typography.Title level={3}>Set up the signer</Typography.Title>
      <Steps current={step} items={STEPS} />

      {step === 0 && (
        <Card title="The recovery passphrase">
          <Flex vertical gap="middle">
            <Typography.Paragraph type="secondary">
              The signer encrypts its keys under a master key, which the
              recovery passphrase and the unseal key each open. The passphrase
              is for people: after a deliberate seal, or a start without the
              unseal key. Put it in the password manager now.
            </Typography.Paragraph>
            {!isAdmin && (
              <Alert
                type="warning"
                showIcon
                title="Only a pki-admin can set up the signer"
              />
            )}
            <Form<{ passphrase: string }>
              layout="vertical"
              onFinish={initialise}
            >
              <PassphraseFields label="Recovery passphrase" />
              <Button
                type="primary"
                htmlType="submit"
                loading={busy}
                disabled={!isAdmin}
              >
                Initialise
              </Button>
            </Form>
            <ErrorAlert error={error} />
          </Flex>
        </Card>
      )}

      {step === 1 && unsealKey && (
        <Card title="The unseal key: shown once">
          <Flex vertical gap="middle">
            <Alert
              type="warning"
              showIcon
              title="This page is the only place it is shown"
              description="With it the signer unseals itself at every start. Leaving the page without storing it means sealing and unsealing by hand until the passphrase is rotated."
            />
            <Typography.Paragraph copyable code>
              {unsealKey}
            </Typography.Paragraph>
            <div>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => saveFile(SECRET, unsealKey, "text/plain")}
              >
                Save as {SECRET}
              </Button>
            </div>
            <Typography.Text>On the host:</Typography.Text>
            <Typography.Paragraph code copyable>
              {`install -m 600 ${SECRET} "$SECRETS_DIR/${SECRET}" && rm ${SECRET}`}
            </Typography.Paragraph>
            <Checkbox.Group
              value={checked}
              onChange={(values) => setChecked(values as string[])}
            >
              <Flex vertical gap="small">
                {CHECKLIST.map((item) => (
                  <Checkbox key={item} value={item}>
                    {item}
                  </Checkbox>
                ))}
              </Flex>
            </Checkbox.Group>
            <div>
              <Button
                type="primary"
                disabled={checked.length < CHECKLIST.length}
                onClick={() => {
                  setUnsealKey(undefined);
                  setStep(2);
                }}
              >
                Next
              </Button>
            </div>
          </Flex>
        </Card>
      )}

      {step === 2 && (
        <Card title="Restart, and watch it unseal itself">
          <Flex vertical gap="middle">
            <Typography.Paragraph>
              Restart the stack so the signer starts with its unseal key:
            </Typography.Paragraph>
            <Typography.Paragraph code copyable>
              infra/docker/stack.sh restart harpocrates
            </Typography.Paragraph>
            {restarted ? (
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                title="Unsealed, with nobody typing anything"
                description="Reboot the host later to prove it again."
              />
            ) : (
              <Alert
                type="info"
                showIcon
                icon={<Spin size="small" />}
                title={
                  wentAway
                    ? "Waiting for the signer to come back unsealed"
                    : "Waiting for the restart"
                }
                description="This page checks every few seconds."
              />
            )}
            <div>
              <Button
                type="primary"
                disabled={!restarted}
                onClick={() => setStep(3)}
              >
                Next
              </Button>
            </div>
          </Flex>
        </Card>
      )}

      {step === 3 && (
        <Card title="Who holds what">
          <Flex vertical gap="middle">
            <Table
              size="small"
              pagination={false}
              dataSource={SECRETS}
              columns={[
                { title: "Secret", dataIndex: "secret" },
                { title: "Where", dataIndex: "where" },
                { title: "Opens", dataIndex: "opens" },
              ]}
            />
            <div>
              <Link href="/roots/new">
                <Button type="primary">Create the first root</Button>
              </Link>
            </div>
          </Flex>
        </Card>
      )}
    </Flex>
  );
}
