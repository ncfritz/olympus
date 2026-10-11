"use client";

import { PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS, useAcmeCredentials, useCurrentUser } from "@/lib/api/queries";
import type {
  AcmeCredential,
  CreateAcmeCredentialResponse,
} from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/labels";
import { ErrorAlert } from "./ErrorAlert";

/** A credential's state: never used, its account's, or revoked. */
const stateOf = (
  credential: AcmeCredential,
): { label: string; color: string } => {
  if (credential.revokedAt) return { label: "Revoked", color: "red" };
  if (!credential.account) return { label: "Unused", color: "blue" };
  return credential.account.status === "valid"
    ? { label: "In use", color: "green" }
    : { label: `Account ${credential.account.status}`, color: "default" };
};

const namesOf = (credential: AcmeCredential): string[] => [
  ...(credential.names.exact ?? []),
  ...(credential.names.subtrees ?? []).map((name) => `${name} and below`),
];

/**
 * ACME (ADR 0020, ACME): the External Account Binding credentials that
 * let a host's ACME client register, each with the names it may request.
 * One at a time in a drawer, opened from `?id=`.
 */
export function AcmePage() {
  const params = useSearchParams();
  const router = useRouter();
  const open = params.get("id") ?? undefined;
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<CreateAcmeCredentialResponse>();
  const { isAdmin } = useCurrentUser();
  const { data, error, isLoading } = useAcmeCredentials();
  const show = (id?: string) =>
    router.push(id ? `/acme?id=${encodeURIComponent(id)}` : "/acme");

  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="center" wrap gap="middle">
        <Typography.Title level={3}>ACME</Typography.Title>
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreating(true)}
          >
            New credential
          </Button>
        )}
      </Flex>
      <Typography.Paragraph type="secondary">
        A host&apos;s ACME client registers with a credential made here, and may
        then request certificates from the TLS CA for the names the credential
        allows. Each credential registers one account; its key is shown once.
      </Typography.Paragraph>
      <ErrorAlert error={error} />
      <Table<AcmeCredential>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={data ?? []}
        onRow={(credential) => ({ onClick: () => show(credential.id) })}
        pagination={false}
        columns={[
          { title: "For", dataIndex: "label" },
          {
            title: "Names",
            key: "names",
            ellipsis: true,
            render: (_, credential) => namesOf(credential).join(", "),
          },
          {
            title: "State",
            key: "state",
            render: (_, credential) => {
              const { label, color } = stateOf(credential);
              return <Tag color={color}>{label}</Tag>;
            },
          },
          { title: "Made", dataIndex: "createdAt", render: formatDate },
        ]}
      />
      <Modal
        open={creating}
        title={issued ? "Credential made" : "New ACME credential"}
        footer={null}
        width={720}
        destroyOnHidden
        onCancel={() => {
          setCreating(false);
          setIssued(undefined);
        }}
      >
        {issued ? (
          <IssuedCredential issued={issued} />
        ) : (
          <CredentialForm onCreated={setIssued} />
        )}
      </Modal>
      <CredentialDrawer credentialId={open} onClose={() => show()} />
    </Flex>
  );
}

interface FormValues {
  label: string;
  exact?: string[];
  subtrees?: string[];
}

function CredentialForm({
  onCreated,
}: {
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
          body: { label, names: { exact, subtrees } },
        }),
      );
      setError(undefined);
      await mutate(KEYS.acmeCredentials);
      onCreated(answer);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Form<FormValues> layout="vertical" onFinish={create}>
      <Form.Item
        name="label"
        label="For"
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
      <Button type="primary" htmlType="submit" loading={busy}>
        Make it
      </Button>
      <ErrorAlert error={error} />
    </Form>
  );
}

/** The credential's key, once, and how each client takes it. */
function IssuedCredential({
  issued,
}: {
  issued: CreateAcmeCredentialResponse;
}) {
  const { credential, hmacKey, directoryUrl } = issued;
  const name =
    credential.names.exact?.[0] ??
    `host.${credential.names.subtrees?.[0] ?? "internal.ncfritz.net"}`;
  const commands: { key: string; label: string; text: string }[] = [
    {
      key: "certbot",
      label: "certbot",
      text: [
        `REQUESTS_CA_BUNDLE=/path/to/root.pem certbot certonly \\`,
        `  --server ${directoryUrl} \\`,
        `  --eab-kid ${credential.id} --eab-hmac-key ${hmacKey} \\`,
        `  --email you@ncfritz.net --agree-tos --key-type ecdsa \\`,
        `  --standalone -d ${name}`,
      ].join("\n"),
    },
    {
      key: "lego",
      label: "lego",
      text: [
        `LEGO_CA_CERTIFICATES=/path/to/root.pem lego \\`,
        `  --server ${directoryUrl} \\`,
        `  --eab --kid ${credential.id} --hmac ${hmacKey} \\`,
        `  --email you@ncfritz.net --accept-tos \\`,
        `  --domains ${name} --http run`,
      ].join("\n"),
    },
    {
      key: "acme.sh",
      label: "acme.sh",
      text: [
        `acme.sh --server ${directoryUrl} --ca-bundle /path/to/root.pem \\`,
        `  --register-account -m you@ncfritz.net \\`,
        `  --eab-kid ${credential.id} --eab-hmac-key ${hmacKey}`,
        `acme.sh --server ${directoryUrl} --ca-bundle /path/to/root.pem \\`,
        `  --issue -d ${name} --standalone --keylength ec-256`,
      ].join("\n"),
    },
    {
      key: "caddy",
      label: "Caddy",
      text: [
        "{",
        `  acme_ca ${directoryUrl}`,
        "  acme_ca_root /path/to/root.pem",
        "  acme_eab {",
        `    key_id ${credential.id}`,
        `    mac_key ${hmacKey}`,
        "  }",
        "}",
      ].join("\n"),
    },
  ];
  return (
    <Flex vertical gap="middle">
      <Alert
        type="warning"
        showIcon
        title="The key is shown this once"
        description="Give it to the client now. Registering an account erases it here; if it is lost before then, revoke the credential and make another."
      />
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Directory">
          <Typography.Text code copyable>
            {directoryUrl}
          </Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="Key id">
          <Typography.Text code copyable>
            {credential.id}
          </Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="HMAC key">
          <Typography.Text code copyable>
            {hmacKey}
          </Typography.Text>
        </Descriptions.Item>
      </Descriptions>
      <Tabs
        items={commands.map(({ key, label, text }) => ({
          key,
          label,
          children: (
            <Typography.Paragraph copyable={{ text }}>
              <pre>{text}</pre>
            </Typography.Paragraph>
          ),
        }))}
      />
      <Typography.Text type="secondary">
        The host must trust the root the TLS CA chains to.
      </Typography.Text>
    </Flex>
  );
}

function CredentialDrawer({
  credentialId,
  onClose,
}: {
  credentialId?: string;
  onClose: () => void;
}) {
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const { isAdmin } = useCurrentUser();
  const { data } = useAcmeCredentials();
  const credential = data?.find((c) => c.id === credentialId);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  const revoke = async () => {
    setBusy(true);
    try {
      unwrap(
        await apiClient.POST("/v1/acme/credential/{credentialId}/revoke", {
          params: { path: { credentialId: credentialId! } },
        }),
      );
      setError(undefined);
      await mutate(KEYS.acmeCredentials);
      void messages.success("Revoked");
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={Boolean(credentialId)}
      onClose={() => {
        setError(undefined);
        onClose();
      }}
      size="large"
      title={credential?.label ?? "ACME credential"}
    >
      {messageHolder}
      {credential && (
        <Flex vertical gap="large">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="State">
              <Tag color={stateOf(credential).color}>
                {stateOf(credential).label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Key id">
              <Typography.Text code copyable>
                {credential.id}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Names">
              {(credential.names.exact ?? []).join(", ") || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Subtrees">
              {(credential.names.subtrees ?? []).join(", ") || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Made">
              {formatDateTime(credential.createdAt)} by {credential.principal}
            </Descriptions.Item>
            <Descriptions.Item label="Bound">
              {formatDateTime(credential.boundAt)}
            </Descriptions.Item>
            {credential.revokedAt && (
              <Descriptions.Item label="Revoked">
                {formatDateTime(credential.revokedAt)}
              </Descriptions.Item>
            )}
          </Descriptions>
          {credential.account && (
            <>
              <Typography.Title level={5}>Its account</Typography.Title>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Status">
                  {credential.account.status}
                </Descriptions.Item>
                <Descriptions.Item label="Contacts">
                  {credential.account.contacts.join(", ") || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Key thumbprint">
                  <Typography.Text code>
                    {credential.account.keyThumbprint}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Registered">
                  {formatDateTime(credential.account.createdAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Updated">
                  {formatDateTime(credential.account.updatedAt)}
                </Descriptions.Item>
              </Descriptions>
            </>
          )}
          {isAdmin && !credential.revokedAt && (
            <Flex>
              <Popconfirm
                title="Revoke this credential?"
                description={
                  credential.account
                    ? "Its account is revoked and can order nothing more. Certificates it was issued stay valid until revoked themselves."
                    : "It can no longer register an account."
                }
                okText="Revoke"
                okButtonProps={{ danger: true }}
                onConfirm={revoke}
              >
                <Button danger loading={busy}>
                  Revoke
                </Button>
              </Popconfirm>
            </Flex>
          )}
          <ErrorAlert error={error} />
        </Flex>
      )}
    </Drawer>
  );
}
