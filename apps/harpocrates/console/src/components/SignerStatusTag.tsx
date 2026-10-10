"use client";

import { LockOutlined, UnlockOutlined } from "@ant-design/icons";
import { Tag, Tooltip } from "antd";
import Link from "next/link";
import { useSignerStatus } from "@/lib/api/queries";

/** The signer's seal, in the header: nothing signs while it is sealed. */
export function SignerStatusTag() {
  const { data: status } = useSignerStatus();
  if (!status) return null;
  const [color, label, title] = !status.initialised
    ? ["default", "Not initialised", "The signer has no master key yet"]
    : status.sealed
      ? ["red", "Sealed", "Nothing signs until the signer is unsealed"]
      : ["green", "Unsealed", "The signer is signing"];
  return (
    <Tooltip title={title}>
      <Link href="/" aria-label={`Signer: ${label}`}>
        <Tag
          color={color}
          icon={status.sealed ? <LockOutlined /> : <UnlockOutlined />}
          variant="solid"
        >
          {label}
        </Tag>
      </Link>
    </Tooltip>
  );
}
