import { Descriptions, Flex, Tag, Typography } from "antd";
import type { SshCertificateContents } from "@/lib/api/types";
import { formatDateTime } from "@/lib/labels";
import { SSH_TYPES } from "@/lib/ssh";

/** Far enough ahead to be OpenSSH's "forever". */
const FOREVER = Date.UTC(9999, 0);

/** What an SSH certificate says, as ssh-keygen -L lists it. */
export function SshCertificateView({
  contents,
}: {
  contents: SshCertificateContents;
}) {
  const until = Date.parse(contents.validBefore);
  return (
    <Descriptions
      column={1}
      size="small"
      bordered
      items={[
        {
          key: "type",
          label: "Type",
          children: `${SSH_TYPES[contents.type].label} certificate`,
        },
        {
          key: "key",
          label: "Key",
          children: contents.keyType,
        },
        {
          key: "keyId",
          label: "Key ID",
          children: (
            <Typography.Text code copyable>
              {contents.keyId}
            </Typography.Text>
          ),
        },
        { key: "serial", label: "Serial", children: contents.serial },
        {
          key: "principals",
          label: contents.type === "user" ? "Log in as" : "Host names",
          children: (
            <Flex gap={4} wrap>
              {contents.principals.map((p) => (
                <Tag key={p}>{p}</Tag>
              ))}
            </Flex>
          ),
        },
        {
          key: "valid",
          label: "Valid",
          children: `${formatDateTime(contents.validAfter)} to ${
            until >= FOREVER ? "forever" : formatDateTime(contents.validBefore)
          }`,
        },
        {
          key: "options",
          label: "Critical options",
          children: contents.criticalOptions.length ? (
            <Flex vertical gap={4}>
              {contents.criticalOptions.map((o) => (
                <Typography.Text key={o.name} code>
                  {o.name} {o.value}
                </Typography.Text>
              ))}
            </Flex>
          ) : (
            "None"
          ),
        },
        {
          key: "extensions",
          label: "Extensions",
          children: contents.extensions.length ? (
            <Flex gap={4} wrap>
              {contents.extensions.map((e) => (
                <Tag key={e}>{e}</Tag>
              ))}
            </Flex>
          ) : (
            "None"
          ),
        },
        {
          key: "ca",
          label: "Signed by",
          children: (
            <Typography.Text code>{contents.caFingerprint}</Typography.Text>
          ),
        },
      ]}
    />
  );
}
