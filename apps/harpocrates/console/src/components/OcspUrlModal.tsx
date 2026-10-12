import { Form, Input, Modal, Typography } from "antd";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS } from "@/lib/api/queries";
import type { FullIssuer } from "@/lib/api/types";
import { ErrorAlert } from "./ErrorAlert";

/** The service's rule: an http:// URL. */
const HTTP_URL = /^http:\/\/[^\s/?#]+(\/\S*)?$/;

/**
 * Where a CA's OCSP responder answers (ADR 0036): the distribution
 * host's /ocsp unless set here. Certificates already issued keep the URL
 * they carry, so a change is for a responder that moved.
 */
export function OcspUrlModal({
  issuer,
  open,
  onClose,
}: {
  issuer: FullIssuer;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<{ ocspUrl: string }>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const { mutate } = useSWRConfig();

  const save = async () => {
    const { ocspUrl } = await form.validateFields();
    setBusy(true);
    setError(undefined);
    try {
      unwrap(
        await apiClient.PUT("/v1/issuer/{issuerId}", {
          params: { path: { issuerId: issuer.id } },
          body: { ocspUrl: ocspUrl.trim() },
        }),
      );
      await mutate(KEYS.issuer(issuer.id));
      onClose();
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="OCSP URL"
      open={open}
      onCancel={onClose}
      onOk={save}
      okText="Save"
      confirmLoading={busy}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">
        Where clients ask about what this CA signed. A profile version that
        includes the OCSP URL puts it in the certificates it signs from now on;
        those already issued keep the one they carry, so keep the old one
        answering too.
      </Typography.Paragraph>
      <Form<{ ocspUrl: string }>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ ocspUrl: issuer.ocspUrl }}
      >
        <Form.Item
          name="ocspUrl"
          label="URL"
          extra="Plain http://, as clients fetch it: the responses are signed."
          rules={[
            { required: true, message: "The URL" },
            {
              pattern: HTTP_URL,
              message:
                "An http:// URL, e.g. http://pki.internal.ncfritz.net/ocsp",
            },
          ]}
        >
          <Input placeholder="http://pki.internal.ncfritz.net/ocsp" />
        </Form.Item>
      </Form>
      <ErrorAlert error={error} />
    </Modal>
  );
}
