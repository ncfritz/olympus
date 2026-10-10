"use client";

import { Form, Input } from "antd";

/** At least this long: the service refuses shorter (ADR 0020). */
export const MIN_PASSPHRASE = 12;

/**
 * A passphrase and its confirmation, for a form whose field is
 * `passphrase`. It is never stored by the console.
 */
export function PassphraseFields({
  label,
  extra,
}: {
  label: string;
  extra?: string;
}) {
  return (
    <>
      <Form.Item
        name="passphrase"
        label={label}
        extra={extra}
        rules={[
          { required: true, message: "Required" },
          {
            min: MIN_PASSPHRASE,
            message: `At least ${MIN_PASSPHRASE} characters`,
          },
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        name="confirm"
        label="Again"
        dependencies={["passphrase"]}
        rules={[
          { required: true, message: "Required" },
          ({ getFieldValue }) => ({
            validator: (_, value) =>
              value === getFieldValue("passphrase")
                ? Promise.resolve()
                : Promise.reject(new Error("The two do not match")),
          }),
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
    </>
  );
}
