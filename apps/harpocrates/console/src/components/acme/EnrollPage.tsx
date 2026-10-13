"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Flex,
  Form,
  Input,
  Segmented,
  Select,
  Steps,
  Typography,
} from "antd";
import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { clientSetups, namesOf } from "@/lib/acme";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS, useAcmeClients } from "@/lib/api/queries";
import type { CreateAcmeCredentialResponse } from "@/lib/api/types";
import { formatDateTime } from "@/lib/labels";
import { ErrorAlert } from "../ErrorAlert";
import styles from "./Acme.module.css";

/** How often the page looks for the client binding its credential. */
const POLL_MS = 5000;

interface FormValues {
  label?: string;
  exact?: string[];
  subtrees?: string[];
}

/**
 * Adding an ACME client: what it is and what it may request, then its
 * credential, shown once with how each common client takes it, and then
 * its binding, which the page watches for. The steps down the side, what
 * each asks for beside them.
 */
export function EnrollPage() {
  const [form] = Form.useForm<FormValues>();
  const label = Form.useWatch("label", form);
  const exact = Form.useWatch("exact", form);
  const subtrees = Form.useWatch("subtrees", form);
  const [issued, setIssued] = useState<CreateAcmeCredentialResponse>();
  const { data } = useAcmeClients(issued ? POLL_MS : undefined);
  const bound = issued
    ? data?.clients.find((c) => c.credential.id === issued.credential.id)
        ?.credential
    : undefined;
  const isBound = Boolean(bound?.boundAt);
  const names = issued
    ? namesOf(issued.credential)
    : [...(exact ?? []), ...(subtrees ?? []).map((n) => `${n} and below`)];

  const current = isBound ? 4 : issued ? 3 : names.length ? 1 : label ? 1 : 0;

  return (
    <div className={styles.page}>
      <Flex
        justify="space-between"
        align="center"
        wrap
        gap="middle"
        className={styles.header}
      >
        <div>
          <Typography.Title level={3} className={styles.title}>
            Add an ACME client
          </Typography.Title>
          <Typography.Text type="secondary">
            Its credential (External Account Binding) lets it register once,
            then order certificates for the names it allows
          </Typography.Text>
        </div>
        <Link href="/acme">
          <Button icon={<ArrowLeftOutlined />}>ACME</Button>
        </Link>
      </Flex>
      <section className={styles.enroll}>
        <div className={styles.stepsPane}>
          <Steps
            orientation="vertical"
            size="small"
            current={current}
            items={[
              {
                title: "What it is",
                content:
                  issued?.credential.label ??
                  label ??
                  "Its host, or the client",
              },
              {
                title: "What it may request",
                content: names.length
                  ? names.join(", ")
                  : "DNS names, or subtrees",
              },
              {
                title: "Its credential",
                content: issued
                  ? isBound
                    ? "Given to the client"
                    : "Shown once: give it to the client now"
                  : "Made when you are done",
              },
              {
                title: "Bound",
                content: isBound
                  ? `Registered ${formatDateTime(bound?.boundAt)}`
                  : issued
                    ? "Waiting for the client to register…"
                    : "When the client registers",
              },
            ]}
          />
        </div>
        <div className={styles.workPane}>
          {issued ? (
            <Issued issued={issued} boundAt={bound?.boundAt} />
          ) : (
            <CredentialForm form={form} onCreated={setIssued} />
          )}
        </div>
      </section>
    </div>
  );
}

function CredentialForm({
  form,
  onCreated,
}: {
  form: ReturnType<typeof Form.useForm<FormValues>>[0];
  onCreated: (issued: CreateAcmeCredentialResponse) => void;
}) {
  const { mutate } = useSWRConfig();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const create = async ({ label, exact, subtrees }: FormValues) => {
    setBusy(true);
    try {
      const answer = unwrap(
        await apiClient.POST("/v1/acme/credentials", {
          body: { label: label!, names: { exact, subtrees } },
        }),
      );
      setError(undefined);
      await mutate(KEYS.acmeClients);
      onCreated(answer);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      onFinish={create}
      className={styles.form}
    >
      <Form.Item
        name="label"
        label="What it is"
        extra="The host or the client that will hold it."
        rules={[{ required: true, message: "What it is for" }]}
      >
        <Input placeholder="Caddy on furball" />
      </Form.Item>
      <Form.Item
        name="exact"
        label="Names"
        extra="DNS names it may request exactly."
      >
        <Select
          mode="tags"
          open={false}
          tokenSeparators={[",", " "]}
          placeholder="nas.internal.ncfritz.net"
        />
      </Form.Item>
      <Form.Item
        name="subtrees"
        label="Subtrees"
        extra="Names it may request with every name below them. No wildcards: they need dns-01, which is not offered."
      >
        <Select
          mode="tags"
          open={false}
          tokenSeparators={[",", " "]}
          placeholder="lab.internal.ncfritz.net"
        />
      </Form.Item>
      <Flex vertical gap="middle">
        <span>
          <Button type="primary" htmlType="submit" loading={busy}>
            Make its credential
          </Button>
        </span>
        <ErrorAlert error={error} />
      </Flex>
    </Form>
  );
}

/** The credential, its key shown once, and how each client takes it. */
function Issued({
  issued,
  boundAt,
}: {
  issued: CreateAcmeCredentialResponse;
  boundAt?: string;
}) {
  const { credential, hmacKey, directoryUrl } = issued;
  const name =
    credential.names.exact?.[0] ??
    `host.${credential.names.subtrees?.[0] ?? "internal.ncfritz.net"}`;
  const setups = clientSetups({
    directoryUrl,
    kid: credential.id,
    hmacKey,
    name,
  });
  const [setup, setSetup] = useState(setups[0].key);
  const shown = setups.find((s) => s.key === setup) ?? setups[0];
  return (
    <Flex vertical gap="middle">
      {boundAt ? (
        <Alert
          type="success"
          showIcon
          title={`Bound ${formatDateTime(boundAt)}`}
          description="Its client registered: its HMAC key is erased here, and it can order certificates for its names."
          action={
            <Flex gap="small" wrap>
              <Link href={`/acme?id=${encodeURIComponent(credential.id)}`}>
                <Button type="primary">Open it</Button>
              </Link>
              <Button onClick={() => window.location.reload()}>
                Add another
              </Button>
            </Flex>
          }
        />
      ) : (
        <Alert
          type="warning"
          showIcon
          title="Shown this once"
          description="The HMAC key is erased when an account binds it; if it is lost before then, revoke this credential and make another."
        />
      )}
      <div className={styles.secrets}>
        <Typography.Text type="secondary">Directory URL</Typography.Text>
        <Typography.Text code copyable className={styles.secret}>
          {directoryUrl}
        </Typography.Text>
        <Typography.Text type="secondary">Key ID (--eab-kid)</Typography.Text>
        <Typography.Text code copyable className={styles.secret}>
          {credential.id}
        </Typography.Text>
        <Typography.Text type="secondary">
          HMAC key (--eab-hmac-key)
        </Typography.Text>
        {boundAt ? (
          <Typography.Text type="secondary">Erased when bound</Typography.Text>
        ) : (
          <Typography.Text code copyable className={styles.secret}>
            {hmacKey}
          </Typography.Text>
        )}
      </div>
      {!boundAt && (
        <>
          <Flex justify="space-between" align="center" gap="small" wrap>
            <Segmented
              value={setup}
              onChange={setSetup}
              options={setups.map((s) => ({ value: s.key, label: s.label }))}
              aria-label="Client"
            />
            <Typography.Text copyable={{ text: shown.text }}>
              Copy
            </Typography.Text>
          </Flex>
          <pre className={styles.code}>{shown.text}</pre>
        </>
      )}
      <Typography.Text type="secondary" className={styles.small}>
        The client must trust the root the TLS CA chains to: its certificate is
        on the <Link href="/roots">Roots</Link> page. http-01 fetches from port
        80 on each name, tls-alpn-01 connects to port 443.
      </Typography.Text>
    </Flex>
  );
}
