import { Form, Input, Modal, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { FullIssuer } from "@/lib/api/types";
import { ErrorAlert } from "./ErrorAlert";
import { REFRESHED } from "./imports/refreshed";

/** The service's rule for a CA's ID, as an import's. */
const SLUG = /^[a-z][a-z0-9-]{0,62}$/;

/**
 * Corrects the ID an imported offline CA was given (ADR 0042). Its list
 * and certificate URLs are made from the ID, so the service refuses once
 * anything it signed names them.
 */
export function RenameIssuerModal({
  issuer,
  open,
  onClose,
}: {
  issuer: FullIssuer;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<{ id: string }>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const { mutate } = useSWRConfig();
  const router = useRouter();

  const save = async () => {
    const { id } = await form.validateFields();
    setBusy(true);
    setError(undefined);
    try {
      const renamed = unwrap(
        await apiClient.POST("/v1/issuer/{issuerId}/rename", {
          params: { path: { issuerId: issuer.id } },
          body: { id: id.trim() },
        }),
      ).issuer;
      await mutate(REFRESHED);
      onClose();
      router.replace(`/ca?id=${encodeURIComponent(renamed.id)}`);
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Change its ID"
      open={open}
      onCancel={onClose}
      onOk={save}
      okText="Change it"
      confirmLoading={busy}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">
        Its revocation list and certificate are published under its ID, so
        everything here follows the new one and its old URLs stop resolving.
        That is only allowed while nothing it signed names them.
      </Typography.Paragraph>
      <Form<{ id: string }>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ id: issuer.id }}
      >
        <Form.Item
          name="id"
          label="ID"
          extra="Lower case, digits and hyphens: its tier, number and generation, e.g. intermediate-1-g1."
          rules={[
            { required: true, message: "The ID" },
            { pattern: SLUG, message: "Lower case, digits and hyphens" },
          ]}
        >
          <Input placeholder="intermediate-1-g1" />
        </Form.Item>
      </Form>
      <ErrorAlert error={error} title="Its ID could not be changed" />
    </Modal>
  );
}
