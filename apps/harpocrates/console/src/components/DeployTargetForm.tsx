"use client";

import { Button, Form, Input, Select, Typography } from "antd";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS, useCertificates } from "@/lib/api/queries";
import type { Certificate, FullDeployTarget } from "@/lib/api/types";
import { formatDate } from "@/lib/labels";
import { ErrorAlert } from "./ErrorAlert";

interface Values {
  name: string;
  certificateId: string;
}

/** The service's rule for a target's name, which is also its directory. */
const NAME = /^[a-z0-9][a-z0-9.-]{0,62}$/;

/** A name for a certificate's target: its first DNS name, else its CN. */
export const suggestedName = (certificate: {
  subject: string;
  names?: { dns?: string[] };
}): string =>
  (
    certificate.names?.dns?.[0] ??
    certificate.subject.match(/CN=([^,]+)/)?.[1] ??
    ""
  ).toLowerCase();

/**
 * A new deploy target (ADR 0020, Renewal and delivery): a certificate
 * whose key Harpocrates generated and escrows, written where nginx reads
 * it, and from then on renewed and deployed by the service. Writing the
 * key out is an escrow export: an admin, after a recent sign-in.
 */
export function DeployTargetForm({
  certificate,
  onCreated,
}: {
  /** The certificate to deploy; without one, the operator picks it. */
  certificate?: Certificate;
  onCreated: (target: FullDeployTarget) => void;
}) {
  const { mutate } = useSWRConfig();
  const [form] = Form.useForm<Values>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState<string>();
  const candidates = useCertificates({
    state: "valid",
    search,
    pageSize: 50,
  });
  const deployable = (candidates.data?.certificates ?? []).filter(
    (c) => c.keyLocation === "signer",
  );

  const create = async (values: Values) => {
    setBusy(true);
    try {
      const { deployTarget } = unwrap(
        await apiClient.POST("/v1/deploy-targets", { body: values }),
      );
      setError(undefined);
      await mutate(KEYS.deployTargets);
      onCreated(deployTarget);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Form<Values>
      form={form}
      layout="vertical"
      initialValues={
        certificate
          ? { certificateId: certificate.id, name: suggestedName(certificate) }
          : undefined
      }
      onFinish={create}
    >
      {!certificate && (
        <Form.Item
          name="certificateId"
          label="Certificate"
          extra="Valid certificates whose key Harpocrates generated and escrows."
          rules={[{ required: true, message: "The certificate to deploy" }]}
        >
          <Select
            showSearch={{ filterOption: false, onSearch: setSearch }}
            loading={candidates.isLoading}
            placeholder="Search by subject or name"
            onChange={(id: string) => {
              const picked = deployable.find((c) => c.id === id);
              if (picked && !form.getFieldValue("name")) {
                form.setFieldValue("name", suggestedName(picked));
              }
            }}
            options={deployable.map((c) => ({
              value: c.id,
              label: `${c.subject} (${c.profileId ?? "no profile"}, expires ${formatDate(c.notAfter)})`,
            }))}
          />
        </Form.Item>
      )}
      <Form.Item
        name="name"
        label="Name"
        extra={
          <>
            Also its directory: nginx reads{" "}
            <Typography.Text code>
              /srv/harpocrates/deployed/&lt;name&gt;/fullchain.pem
            </Typography.Text>{" "}
            and <Typography.Text code>privkey.pem</Typography.Text>.
          </>
        }
        rules={[
          { required: true, message: "A name for the target" },
          {
            pattern: NAME,
            message:
              "Lower-case letters, digits, dots and hyphens, starting with a letter or digit",
          },
        ]}
      >
        <Input placeholder="nas.internal.ncfritz.net" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={busy}>
        Deploy it here
      </Button>
      <ErrorAlert error={error} />
    </Form>
  );
}
