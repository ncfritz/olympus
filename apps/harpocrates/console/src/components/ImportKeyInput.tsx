"use client";

import { UploadOutlined } from "@ant-design/icons";
import { Button, Flex, Input, Typography, Upload } from "antd";
import { useState } from "react";
import type { KeyImportFormat } from "@/lib/api/types";

export interface ImportKeyInputProps {
  format: KeyImportFormat;
  value?: string;
  onChange?: (data: string | undefined) => void;
}

/** A file's bytes, base64: as a PKCS#12 file goes to the service. */
const base64Of = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/**
 * A key brought to be certified, read in the browser: encrypted PKCS#8,
 * pasted or from a file, or a PKCS#12 file. It goes to the service in the
 * request that issues the certificate, and nowhere else.
 */
export function ImportKeyInput({
  format,
  value,
  onChange,
}: ImportKeyInputProps) {
  const [name, setName] = useState<string>();
  const upload = (
    <Upload
      accept={format === "pkcs12" ? ".p12,.pfx" : ".pem,.key"}
      maxCount={1}
      showUploadList={false}
      beforeUpload={async (file) => {
        setName(file.name);
        onChange?.(
          format === "pkcs12" ? await base64Of(file) : await file.text(),
        );
        return false;
      }}
    >
      <Button icon={<UploadOutlined />}>
        {format === "pkcs12" ? "Choose the .p12 file" : "Or choose the file"}
      </Button>
    </Upload>
  );
  if (format === "pkcs12") {
    return (
      <Flex gap="small" align="center">
        {upload}
        {value && name && <Typography.Text>Read {name}</Typography.Text>}
      </Flex>
    );
  }
  return (
    <Flex vertical gap="small">
      <Input.TextArea
        rows={6}
        spellCheck={false}
        placeholder="-----BEGIN ENCRYPTED PRIVATE KEY-----"
        value={value}
        onChange={(event) => onChange?.(event.target.value || undefined)}
      />
      <div>{upload}</div>
    </Flex>
  );
}
