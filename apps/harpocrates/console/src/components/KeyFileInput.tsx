"use client";

import { UploadOutlined } from "@ant-design/icons";
import { Button, Typography, Upload } from "antd";
import { useState } from "react";

export interface KeyFileInputProps {
  value?: string;
  onChange?: (pem: string | undefined) => void;
}

/**
 * An offline CA's encrypted key, read from the offline media in the
 * browser. Its text goes to the service in the request that opens the
 * ceremony, and nowhere else.
 */
export function KeyFileInput({ value, onChange }: KeyFileInputProps) {
  const [name, setName] = useState<string>();
  return (
    <Upload
      accept=".pem,.key"
      maxCount={1}
      showUploadList={false}
      beforeUpload={async (file) => {
        const text = await file.text();
        setName(file.name);
        onChange?.(text.includes("ENCRYPTED PRIVATE KEY") ? text : undefined);
        return false;
      }}
    >
      <Button icon={<UploadOutlined />}>
        {value ? `Read ${name}` : "Choose the key file"}
      </Button>
      {name && !value && (
        <Typography.Text type="danger">
          {" "}
          {name} is not an encrypted private key
        </Typography.Text>
      )}
    </Upload>
  );
}
