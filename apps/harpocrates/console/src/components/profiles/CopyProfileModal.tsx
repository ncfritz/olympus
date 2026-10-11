import { Form, Input, Modal, Select } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS } from "@/lib/api/queries";
import type { Profile, ProfileVersion } from "@/lib/api/types";
import { ErrorAlert } from "../ErrorAlert";

const PROFILE_SLUG = /^[a-z][a-z0-9-]{0,62}$/;

type Values = { id: string; description: string; version: number };

/** A new profile from one of a profile's versions, as its v1. */
export function CopyProfileModal({
  profile,
  versions,
  open,
  onClose,
}: {
  profile: Profile;
  versions: ProfileVersion[];
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const copy = async () => {
    const values = await form.validateFields();
    setBusy(true);
    setError(undefined);
    try {
      const copied = unwrap(
        await apiClient.POST("/v1/profile/{profileId}/copy", {
          params: { path: { profileId: profile.id } },
          body: values,
        }),
      ).profile;
      await mutate(KEYS.profiles);
      onClose();
      router.push(`/profiles?id=${copied.id}`);
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Copy ${profile.id}`}
      open={open}
      onCancel={onClose}
      onOk={copy}
      okText="Copy"
      confirmLoading={busy}
      destroyOnHidden
    >
      <Form<Values>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{
          id: `${profile.id}-copy`,
          description: profile.description,
          version: profile.version,
        }}
      >
        <Form.Item
          name="id"
          label="New profile's name"
          rules={[
            { required: true, message: "Required" },
            {
              pattern: PROFILE_SLUG,
              message: "Lower case, digits and hyphens",
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="description"
          label="Description"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item
          name="version"
          label="Copied from"
          tooltip="Its settings become the new profile's v1."
        >
          <Select
            options={versions.map((v) => ({
              value: v.version,
              label: `v${v.version}${v.version === profile.version ? " (latest)" : ""}`,
            }))}
          />
        </Form.Item>
      </Form>
      <ErrorAlert error={error} />
    </Modal>
  );
}
