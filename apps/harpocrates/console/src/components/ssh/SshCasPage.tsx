"use client";

import { PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Descriptions,
  Flex,
  Form,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import { type ReactNode, useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS, useCurrentUser, useSshCas } from "@/lib/api/queries";
import type { SshCa, SshCertificateType } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/labels";
import { describeHours, SSH_TYPES } from "@/lib/ssh";
import { ErrorAlert } from "../ErrorAlert";

/** Where a CA's line is installed, and what it does there. */
const TRUST: Record<SshCertificateType, ReactNode> = {
  user: (
    <>
      On every host, in the file{" "}
      <Typography.Text code>TrustedUserCAKeys</Typography.Text> names in{" "}
      <Typography.Text code>sshd_config</Typography.Text>: the host then lets in
      whoever holds a certificate from it for one of its accounts.
    </>
  ),
  host: (
    <>
      On every client, in{" "}
      <Typography.Text code>~/.ssh/known_hosts</Typography.Text> or{" "}
      <Typography.Text code>/etc/ssh/ssh_known_hosts</Typography.Text>: the
      client then trusts any host whose certificate it signed for the name
      connected to, without a prompt.
    </>
  ),
};

interface NewCa {
  type: SshCertificateType;
  number?: number;
  maxValidityHours?: number;
}

/**
 * The SSH CAs (ADR 0035): online Ed25519 keys in the signer, one per
 * type and number, each with the line that trusts it. A rotation is the
 * next generation, trusted beside the old until the old is retired and its
 * last certificate expires.
 */
export function SshCasPage() {
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const { isAdmin } = useCurrentUser();
  const { data: cas, error, isLoading } = useSshCas();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [failure, setFailure] = useState<unknown>();
  const [form] = Form.useForm<NewCa>();
  const type = Form.useWatch("type", form);

  const create = async (request: NewCa, key: string) => {
    setBusy(key);
    try {
      const { ca } = unwrap(
        await apiClient.POST("/v1/ssh/cas", { body: request }),
      );
      setFailure(undefined);
      setCreating(false);
      await mutate(KEYS.sshCas);
      void messages.success(`${ca.name} created`);
    } catch (problem) {
      setFailure(problem);
    } finally {
      setBusy(undefined);
    }
  };

  const retire = async (ca: SshCa) => {
    setBusy(`retire-${ca.id}`);
    try {
      unwrap(
        await apiClient.POST("/v1/ssh/ca/{caId}/retire", {
          params: { path: { caId: ca.id } },
        }),
      );
      setFailure(undefined);
      await mutate(KEYS.sshCas);
      void messages.success(`${ca.name} retired`);
    } catch (problem) {
      setFailure(problem);
    } finally {
      setBusy(undefined);
    }
  };

  /** Whether a CA has a newer generation beside it. */
  const superseded = (ca: SshCa) =>
    (cas ?? []).some(
      (other) =>
        other.type === ca.type &&
        other.number === ca.number &&
        other.generation > ca.generation,
    );

  return (
    <Flex vertical gap="large">
      {messageHolder}
      <Flex justify="space-between" align="center" wrap gap="middle">
        <Typography.Title level={3}>SSH CAs</Typography.Title>
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setFailure(undefined);
              setCreating(true);
            }}
          >
            New CA
          </Button>
        )}
      </Flex>
      <Typography.Paragraph type="secondary">
        A user CA signs certificates that log people in; a host CA signs
        certificates that vouch for hosts. Each is an online key in the signer,
        made without a ceremony. Install each CA&apos;s line where it is
        trusted; to rotate, make its next generation, install that line beside
        the old, and retire the old once nothing it signed is still used.
      </Typography.Paragraph>
      <ErrorAlert error={error} />
      {!creating && <ErrorAlert error={failure} />}
      <Table<SshCa>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={cas ?? []}
        pagination={false}
        expandable={{
          expandRowByClick: true,
          expandedRowRender: (ca) => (
            <Flex vertical gap="middle">
              <Descriptions
                column={1}
                size="small"
                bordered
                items={[
                  {
                    key: "trust",
                    label: "Trusted by this line",
                    children: (
                      <Flex vertical gap="small">
                        <Typography.Paragraph
                          code
                          copyable={{ text: ca.trustLine }}
                        >
                          {ca.trustLine}
                        </Typography.Paragraph>
                        <Typography.Text type="secondary">
                          {TRUST[ca.type]}
                        </Typography.Text>
                      </Flex>
                    ),
                  },
                  {
                    key: "krl",
                    label: "Revocations",
                    children: (
                      <Flex vertical gap="small">
                        <Typography.Text type="secondary">
                          {ca.type === "user" ? (
                            <>
                              Hosts fetch every user CA&apos;s revocations in
                              one KRL, over HTTPS from the renewal listener
                              (harpocrates-ssh-host krl), into the file{" "}
                              <Typography.Text code>
                                RevokedKeys
                              </Typography.Text>{" "}
                              names. As published:
                            </>
                          ) : (
                            <>
                              Clients may fetch every host CA&apos;s revocations
                              in one KRL into the file{" "}
                              <Typography.Text code>
                                RevokedHostKeys
                              </Typography.Text>{" "}
                              names in{" "}
                              <Typography.Text code>ssh_config</Typography.Text>
                              . As published:
                            </>
                          )}
                        </Typography.Text>
                        <Typography.Text code copyable>
                          {ca.typeKrlUrl}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          This CA&apos;s alone:
                        </Typography.Text>
                        <Typography.Text code copyable>
                          {ca.krlUrl}
                        </Typography.Text>
                      </Flex>
                    ),
                  },
                  {
                    key: "longest",
                    label: "Signs for at most",
                    children: describeHours(ca.maxValidityHours),
                  },
                  {
                    key: "created",
                    label: "Created",
                    children: formatDateTime(ca.createdAt),
                  },
                  ...(ca.retiredAt
                    ? [
                        {
                          key: "retired",
                          label: "Retired",
                          children: formatDateTime(ca.retiredAt),
                        },
                      ]
                    : []),
                ]}
              />
              {isAdmin && ca.status === "active" && (
                <Flex gap="small" wrap>
                  {!superseded(ca) && (
                    <Popconfirm
                      title={`Make ${ca.type} CA ${ca.number}'s next generation?`}
                      description="A new key, its own line to install beside this one's. Profiles that are not pinned move to it at once."
                      okText="Make it"
                      onConfirm={() =>
                        create(
                          {
                            type: ca.type,
                            number: ca.number,
                            maxValidityHours: ca.maxValidityHours,
                          },
                          `rotate-${ca.id}`,
                        )
                      }
                    >
                      <Button loading={busy === `rotate-${ca.id}`}>
                        Next generation
                      </Button>
                    </Popconfirm>
                  )}
                  <Popconfirm
                    title={`Retire ${ca.name}?`}
                    description="It signs nothing more. What it signed stays valid until it expires, so keep its line until then."
                    okText="Retire"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => retire(ca)}
                  >
                    <Button danger loading={busy === `retire-${ca.id}`}>
                      Retire
                    </Button>
                  </Popconfirm>
                </Flex>
              )}
            </Flex>
          ),
        }}
        columns={[
          { title: "Name", dataIndex: "name" },
          {
            title: "Type",
            dataIndex: "type",
            render: (value: SshCertificateType) => SSH_TYPES[value].label,
          },
          { title: "Generation", dataIndex: "generation" },
          {
            title: "Status",
            key: "status",
            render: (_, ca) =>
              ca.status === "retired" ? (
                <Tag>retired</Tag>
              ) : superseded(ca) ? (
                <Tag color="gold">active, superseded</Tag>
              ) : (
                <Tag color="green">active</Tag>
              ),
          },
          {
            title: "Signs for at most",
            dataIndex: "maxValidityHours",
            render: describeHours,
          },
          { title: "Created", dataIndex: "createdAt", render: formatDate },
        ]}
      />
      <Modal
        open={creating}
        title="New SSH CA"
        okText="Create"
        confirmLoading={busy === "create"}
        destroyOnHidden
        onCancel={() => setCreating(false)}
        onOk={async () => create(await form.validateFields(), "create")}
      >
        <Form<NewCa>
          form={form}
          layout="vertical"
          initialValues={{ type: "user" }}
          preserve={false}
        >
          <Form.Item
            name="type"
            label="What it signs"
            extra={type && SSH_TYPES[type].help}
          >
            <Select
              options={(["user", "host"] as const).map((t) => ({
                value: t,
                label: `${SSH_TYPES[t].label} certificates`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="number"
            label="Number"
            extra="1 unless another CA of this type is wanted beside it. For a number that has a CA, this makes its next generation."
          >
            <InputNumber min={1} max={99} placeholder="1" />
          </Form.Item>
          <Form.Item
            name="maxValidityHours"
            label="Longest certificate it signs"
            extra="By default a week for user certificates, a year for host certificates."
          >
            <InputNumber
              min={1}
              max={400 * 24}
              addonAfter="hours"
              placeholder={type === "host" ? "8760" : "168"}
            />
          </Form.Item>
        </Form>
        <ErrorAlert error={failure} />
      </Modal>
    </Flex>
  );
}
