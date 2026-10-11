import { Form, Modal, Select, Typography } from "antd";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS } from "@/lib/api/queries";
import type { ContactNames, FullIssuer } from "@/lib/api/types";
import { ErrorAlert } from "./ErrorAlert";

/**
 * A CA's issuer alternative names (ADR 0034): how whoever runs it is
 * reached, which certificates it signs carry where their profile version
 * says. They describe the CA, so only the CA has them.
 */
export function IssuerAltNamesModal({
  issuer,
  open,
  onClose,
}: {
  issuer: FullIssuer;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<ContactNames>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const { mutate } = useSWRConfig();

  const save = async () => {
    const values = await form.validateFields();
    setBusy(true);
    setError(undefined);
    try {
      unwrap(
        await apiClient.PUT("/v1/issuer/{issuerId}", {
          params: { path: { issuerId: issuer.id } },
          body: {
            alternativeNames: {
              email: values.email ?? [],
              uri: values.uri ?? [],
            },
          },
        }),
      );
      await mutate(KEYS.issuer(issuer.id));
      await mutate(KEYS.issuers);
      onClose();
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Issuer alternative names"
      open={open}
      onCancel={onClose}
      onOk={save}
      okText="Save"
      confirmLoading={busy}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">
        How whoever runs this CA is reached. A profile version that includes the
        issuer&apos;s alternative names puts these in the certificates it signs.
      </Typography.Paragraph>
      <Form<ContactNames>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={issuer.alternativeNames}
      >
        <Form.Item name="email" label="Email addresses">
          <Select
            mode="tags"
            open={false}
            tokenSeparators={[",", " "]}
            placeholder="pki@ncfritz.net"
          />
        </Form.Item>
        <Form.Item name="uri" label="URIs">
          <Select
            mode="tags"
            open={false}
            tokenSeparators={[",", " "]}
            placeholder="https://pki.internal.ncfritz.net/"
          />
        </Form.Item>
      </Form>
      <ErrorAlert error={error} />
    </Modal>
  );
}
