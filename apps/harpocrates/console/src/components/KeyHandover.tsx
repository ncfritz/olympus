"use client";

import { DownloadOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Flex, Typography } from "antd";
import { useState } from "react";
import { saveFile } from "@/lib/download";

const CHECKLIST = [
  "The key file is on the offline media",
  "A second copy is on separate offline media",
  "The export passphrase is in the password manager",
];

export interface KeyHandoverProps {
  /** The CA's slug, for the file's name. */
  issuerId: string;
  /** Encrypted PKCS#8, PEM: the only copy there is. */
  encryptedKey: string;
  /** Once every box is ticked. */
  onDone: () => void;
  doneLabel?: string;
}

/**
 * An offline CA's key, handed over once (ADR 0032, a new root): the
 * signer gave it back encrypted and kept nothing, and this page holds it
 * only until it is left. The operator saves it and says where it went.
 */
export function KeyHandover({
  issuerId,
  encryptedKey,
  onDone,
  doneLabel = "Done",
}: KeyHandoverProps) {
  const [saved, setSaved] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const fileName = `${issuerId}.key.pem`;
  return (
    <Flex vertical gap="middle">
      <Alert
        type="warning"
        showIcon
        title="This is the only copy of the key"
        description="Harpocrates kept nothing: the key is encrypted under the export passphrase and held by this page alone. Leaving the page without saving it loses the CA."
      />
      <Flex gap="middle" align="center" wrap>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => {
            saveFile(fileName, encryptedKey, "application/x-pem-file");
            setSaved(true);
          }}
        >
          Save {fileName}
        </Button>
        {saved && (
          <Typography.Text type="secondary">
            Saved. Move it to the offline media, and delete it from this
            computer once it is there.
          </Typography.Text>
        )}
      </Flex>
      <Checkbox.Group
        value={checked}
        onChange={(values) => setChecked(values as string[])}
      >
        <Flex vertical gap="small">
          {CHECKLIST.map((item) => (
            <Checkbox key={item} value={item} disabled={!saved}>
              {item}
            </Checkbox>
          ))}
        </Flex>
      </Checkbox.Group>
      <div>
        <Button
          type="primary"
          disabled={!saved || checked.length < CHECKLIST.length}
          onClick={onDone}
        >
          {doneLabel}
        </Button>
      </div>
    </Flex>
  );
}
