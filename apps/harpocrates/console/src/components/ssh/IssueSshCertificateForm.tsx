"use client";

import { Button, Checkbox, Flex, Form, Input, Select, Typography } from "antd";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import {
  isSshCertificateKey,
  useProfiles,
  useSshPrincipals,
} from "@/lib/api/queries";
import type { SshCertificate, SshCertificateType } from "@/lib/api/types";
import { describeHours } from "@/lib/ssh";
import { ErrorAlert } from "../ErrorAlert";

/** An OpenSSH public key line, roughly: the service reads it properly. */
const PUBLIC_KEY =
  /^(ssh-ed25519|ecdsa-sha2-nistp\d+|ssh-rsa) [A-Za-z0-9+/]+=*( .*)?$/;

/** A host name, as a principal (the service's rule); it lowers its case. */
const HOST_NAME = /^[A-Za-z0-9*?][A-Za-z0-9.*?_-]{0,252}$/;

interface Values {
  publicKey: string;
  profileId?: string;
  identity?: string;
  principals?: string[];
}

export interface IssueSshCertificateFormProps {
  type: SshCertificateType;
  /**
   * For whom a user certificate is: one's own (with one's principals), or,
   * for an admin, any mapped identity.
   */
  forWhom: "self" | "anyone";
  /** One's own principals, for one's own certificate. */
  ownPrincipals?: string[];
  onIssued: (certificate: SshCertificate) => void;
}

/**
 * Issuing an SSH certificate (ADR 0035) for a public key submitted here:
 * Harpocrates never makes an SSH key. A user certificate carries the
 * identity's mapped principals, or fewer; a host certificate, the names
 * the host is reached by.
 */
export function IssueSshCertificateForm({
  type,
  forWhom,
  ownPrincipals = [],
  onIssued,
}: IssueSshCertificateFormProps) {
  const { mutate } = useSWRConfig();
  const [form] = Form.useForm<Values>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const { data: profiles } = useProfiles();
  const { data: mappings } = useSshPrincipals(
    type === "user" && forWhom === "anyone",
  );
  const identity = Form.useWatch("identity", form);

  const choices = useMemo(
    () =>
      (profiles ?? []).filter(
        (p) => p.kind === "ssh" && p.active && p.ssh?.certificateType === type,
      ),
    [profiles, type],
  );
  const mapped =
    forWhom === "self"
      ? ownPrincipals
      : (mappings?.find((m) => m.identity === identity)?.principals ?? []);

  const issue = async (values: Values) => {
    setBusy(true);
    try {
      const publicKey = values.publicKey.trim();
      const { certificate } =
        type === "user"
          ? unwrap(
              await apiClient.POST("/v1/ssh/certificates/user", {
                body: {
                  publicKey,
                  profileId: values.profileId,
                  identity: forWhom === "anyone" ? values.identity : undefined,
                  principals: values.principals,
                },
              }),
            )
          : unwrap(
              await apiClient.POST("/v1/ssh/certificates/host", {
                body: {
                  publicKey,
                  profileId: values.profileId,
                  principals: values.principals ?? [],
                },
              }),
            );
      setError(undefined);
      await mutate(isSshCertificateKey);
      onIssued(certificate);
    } catch (problem) {
      setError(problem);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Form<Values>
      form={form}
      layout="vertical"
      onFinish={issue}
      initialValues={{
        profileId: `ssh-${type}`,
        principals: type === "user" ? ownPrincipals : [],
      }}
    >
      <Form.Item
        name="publicKey"
        label={type === "user" ? "Public key" : "The host's public key"}
        extra={
          type === "user" ? (
            <>
              The contents of{" "}
              <Typography.Text code>~/.ssh/id_ed25519.pub</Typography.Text>{" "}
              (ssh-keygen -t ed25519 makes one). The private key never leaves
              your machine.
            </>
          ) : (
            <>
              The contents of{" "}
              <Typography.Text code>
                /etc/ssh/ssh_host_ed25519_key.pub
              </Typography.Text>{" "}
              on the host. From then on the host renews the certificate itself.
            </>
          )
        }
        rules={[
          { required: true, message: "The public key" },
          {
            pattern: PUBLIC_KEY,
            message: "One OpenSSH public key line: ssh-ed25519 AAAA…",
            transform: (value: string) => value?.trim(),
          },
        ]}
      >
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 6 }}
          placeholder="ssh-ed25519 AAAA… comment"
        />
      </Form.Item>
      {/* The profiles are the PKI roles' to list: without one, the default. */}
      {choices.length > 0 && (
        <Form.Item name="profileId" label="Profile">
          <Select
            options={choices.map((p) => ({
              value: p.id,
              label: `${p.id}: ${describeHours(p.ssh!.validityHours)}`,
            }))}
          />
        </Form.Item>
      )}
      {type === "user" && forWhom === "anyone" && (
        <Form.Item
          name="identity"
          label="For"
          extra="An Olympus identity with principals: who may log in as whom."
          rules={[{ required: true, message: "Whom it is for" }]}
        >
          <Select
            showSearch
            placeholder="neil@ncfritz.net"
            options={(mappings ?? []).map((m) => ({
              value: m.identity,
              label: `${m.identity} (${m.principals.join(", ")})`,
            }))}
            onChange={(value: string) =>
              form.setFieldValue(
                "principals",
                mappings?.find((m) => m.identity === value)?.principals ?? [],
              )
            }
          />
        </Form.Item>
      )}
      {type === "user" ? (
        <Form.Item
          name="principals"
          label="Log in as"
          extra="Of the principals mapped to the identity; all of them unless fewer are wanted."
          rules={[{ required: true, message: "At least one" }]}
        >
          {mapped.length ? (
            <Checkbox.Group options={mapped} />
          ) : (
            <Typography.Text type="secondary">
              {forWhom === "self" || identity
                ? "No principals are mapped: an admin maps them."
                : "Choose whom it is for."}
            </Typography.Text>
          )}
        </Form.Item>
      ) : (
        <Form.Item
          name="principals"
          label="Host names"
          extra="Every name clients connect to it by, the full one first: mini.internal.ncfritz.net, mini."
          rules={[
            { required: true, message: "At least one name" },
            {
              validator: async (_, value: string[] | undefined) => {
                const bad = (value ?? []).find((v) => !HOST_NAME.test(v));
                if (bad) throw new Error(`${bad} is not a host name`);
              },
            },
          ]}
        >
          <Select
            mode="tags"
            open={false}
            tokenSeparators={[",", " "]}
            placeholder="mini.internal.ncfritz.net, mini"
          />
        </Form.Item>
      )}
      <Flex vertical gap="middle">
        <div>
          <Button type="primary" htmlType="submit" loading={busy}>
            Issue
          </Button>
        </div>
        <ErrorAlert error={error} />
      </Flex>
    </Form>
  );
}
