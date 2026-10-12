"use client";

import { PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Flex,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS, useSshPrincipals } from "@/lib/api/queries";
import type { SshPrincipalMapping } from "@/lib/api/types";
import { formatDateTime } from "@/lib/labels";
import { ErrorAlert } from "../ErrorAlert";

/** A Unix user name, as a principal: the service's rule. */
const PRINCIPAL = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,31}$/;

interface Values {
  identity: string;
  principals: string[];
}

/**
 * Who may log in as whom (ADR 0035): each Olympus identity, by its email,
 * mapped to the accounts its user certificates may carry. Without a
 * mapping there is no user certificate. Changing one changes only
 * certificates issued after.
 */
export function SshPrincipalsPage() {
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const { data, error, isLoading } = useSshPrincipals();
  const [editing, setEditing] = useState<SshPrincipalMapping | "new">();
  const [busy, setBusy] = useState<string>();
  const [failure, setFailure] = useState<unknown>();
  const [form] = Form.useForm<Values>();

  const set = async (identity: string, principals: string[], done: string) => {
    setBusy(identity);
    try {
      unwrap(
        await apiClient.PUT("/v1/ssh/principals/{identity}", {
          params: { path: { identity } },
          body: { principals },
        }),
      );
      setFailure(undefined);
      setEditing(undefined);
      await mutate(KEYS.sshPrincipals);
      void messages.success(done);
    } catch (problem) {
      setFailure(problem);
    } finally {
      setBusy(undefined);
    }
  };

  const open = (mapping: SshPrincipalMapping | "new") => {
    setFailure(undefined);
    setEditing(mapping);
  };

  return (
    <Flex vertical gap="large">
      {messageHolder}
      <Flex justify="space-between" align="center" wrap gap="middle">
        <Typography.Title level={3}>Principals</Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => open("new")}
        >
          Map an identity
        </Button>
      </Flex>
      <Typography.Paragraph type="secondary">
        Who may log in as whom. Someone signed in to Olympus gets a user
        certificate carrying the accounts their identity is mapped to, or fewer,
        and never others. A change applies to certificates issued after it;
        revoke one to take back what it already allows.
      </Typography.Paragraph>
      <ErrorAlert error={error} />
      {!editing && <ErrorAlert error={failure} />}
      <Table<SshPrincipalMapping>
        rowKey="identity"
        size="small"
        loading={isLoading}
        dataSource={data ?? []}
        pagination={false}
        columns={[
          { title: "Identity", dataIndex: "identity" },
          {
            title: "Logs in as",
            dataIndex: "principals",
            render: (principals: string[]) => (
              <Flex gap={4} wrap>
                {principals.map((p) => (
                  <Tag key={p}>{p}</Tag>
                ))}
              </Flex>
            ),
          },
          {
            title: "Updated",
            dataIndex: "updatedAt",
            render: formatDateTime,
          },
          {
            title: "",
            key: "actions",
            align: "right",
            render: (_, mapping) => (
              <Flex gap="small" justify="end">
                <Button size="small" onClick={() => open(mapping)}>
                  Edit
                </Button>
                <Popconfirm
                  title={`Remove ${mapping.identity}'s mapping?`}
                  description="They get no new user certificate. Those already issued work until they expire or are revoked."
                  okText="Remove"
                  okButtonProps={{ danger: true }}
                  onConfirm={() =>
                    set(mapping.identity, [], `${mapping.identity} removed`)
                  }
                >
                  <Button
                    size="small"
                    danger
                    loading={busy === mapping.identity && !editing}
                  >
                    Remove
                  </Button>
                </Popconfirm>
              </Flex>
            ),
          },
        ]}
      />
      <Modal
        open={Boolean(editing)}
        title={
          editing === "new"
            ? "Map an identity"
            : `Who ${editing?.identity} logs in as`
        }
        okText="Save"
        confirmLoading={Boolean(busy)}
        destroyOnHidden
        onCancel={() => setEditing(undefined)}
        onOk={async () => {
          const values = await form.validateFields();
          const identity =
            editing === "new" ? values.identity.trim() : editing!.identity;
          await set(identity, values.principals, `${identity} saved`);
        }}
      >
        <Form<Values>
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={
            editing && editing !== "new"
              ? { principals: editing.principals }
              : { principals: [] }
          }
        >
          {editing === "new" && (
            <Form.Item
              name="identity"
              label="Identity"
              extra="Their Olympus sign-in, by email."
              rules={[
                { required: true, message: "Their email" },
                { type: "email", message: "An email address" },
              ]}
            >
              <Input placeholder="neil@ncfritz.net" />
            </Form.Item>
          )}
          <Form.Item
            name="principals"
            label="Logs in as"
            extra="Accounts on the hosts: ncfritz, admin. A host lets them in as one only if it trusts the user CA and has the account."
            rules={[
              { required: true, message: "At least one" },
              {
                validator: async (_, value: string[] | undefined) => {
                  const bad = (value ?? []).find((v) => !PRINCIPAL.test(v));
                  if (bad) throw new Error(`${bad} is not an account name`);
                },
              },
            ]}
          >
            <Select
              mode="tags"
              open={false}
              tokenSeparators={[",", " "]}
              placeholder="ncfritz"
            />
          </Form.Item>
        </Form>
        <ErrorAlert error={failure} />
      </Modal>
    </Flex>
  );
}
