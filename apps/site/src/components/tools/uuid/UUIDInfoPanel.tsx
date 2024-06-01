import { CopyOutlined } from "@ant-design/icons";
import { Button, Collapse, Space, Typography } from "antd";
import React from "react";
import { useCopyToClipboard } from "usehooks-ts";
import {
  NAMESPACE_DNS,
  NAMESPACE_OID,
  NAMESPACE_URL,
  NAMESPACE_X_500_DN,
} from "./constants";
import { V1_INFO_PANEL, V35_INFO_PANEL, V4_INFO_PANEL } from "./infoPanels";

export interface UUIDInfoPanelProps {
  activeInfoKey?: string[];
  setActiveInfoKey: (key: string[]) => void;
}

const UUIDInfoPanel: React.FunctionComponent<UUIDInfoPanelProps> = ({
  activeInfoKey,
  setActiveInfoKey,
}: UUIDInfoPanelProps) => {
  const [copiedValue, copy] = useCopyToClipboard();

  return (
    <Space
      direction={"vertical"}
      size={8}
      style={{ marginLeft: 16, marginRight: 16 }}
    >
      <Typography.Text>
        Embedded in every UUID is the version and variant of the UUID. Other
        information such as the time the UUID was generated can also be
        extracted in some cases.
      </Typography.Text>
      <Typography.Text
        style={{
          display: "flex",
          justifyContent: "center",
          fontSize: 24,
          fontFamily: "monospace",
        }}
      >
        xxxxxxxx-xxxx-
        <span style={{ color: "#ff0000", fontWeight: 600 }}>M</span>xxx-
        <span style={{ color: "#ff33cc", fontWeight: 600 }}>N</span>
        xxx-xxxxxxxxxxxx
      </Typography.Text>
      <Typography.Text>
        The UUID version is represented by the 13th digit of a hexadecimal UUID
        string (
        <span
          style={{
            color: "#ff0000",
            fontWeight: 600,
            fontFamily: "monospace",
          }}
        >
          M
        </span>{" "}
        in the diagram below). The variant is represented in the 17th digit (
        <span
          style={{
            color: "#ff0000",
            fontWeight: 600,
            fontFamily: "monospace",
          }}
        >
          N
        </span>{" "}
        in the diagram below).
      </Typography.Text>
      <Collapse
        ghost={true}
        activeKey={activeInfoKey}
        onChange={(key) => {
          setActiveInfoKey(Array.isArray(key) ? key : [key]);
        }}
        items={[
          {
            key: "v1",
            label: "Version 1",
            children: (
              <Space direction={"vertical"} size={8}>
                <Typography.Text>
                  Version-1 is based on the current time and the MAC address for
                  the computer or "node" generating the UUID.
                </Typography.Text>
                <Typography.Text>
                  RFC 4122 states timestamp is number of nanoseconds since
                  October 15, 1582 at midnight UTC. Most computers do not have a
                  clock that ticks fast enough to measure time in nanoseconds.
                  Instead, a random number is often used to fill in timestamp
                  digits beyond the computer's measurement accuracy. When
                  multiple version-1 UUIDs are generated in a single API call
                  the random portion may be incremented rather than regenerated
                  for each UUID. This ensures uniqueness and is faster to
                  generate.
                </Typography.Text>
                <Typography.Text>
                  The last 12 hex digits of a UUID string represent the MAC
                  address of the node. In some implementations (including the
                  UUID generator on this site) a random MAC address is used
                  instead of the node's actual MAC.
                </Typography.Text>
                {V1_INFO_PANEL}
              </Space>
            ),
          },
          {
            key: "v35",
            label: "Version 3/5",
            children: (
              <Space direction={"vertical"} size={8}>
                <Typography.Text>
                  Version-3 and version-5 are generated based on a "namespace"
                  and unique "name". Namespace and name are concatenated and
                  hashed. There is no temporal or random component to either
                  versions so the same input produces the same output every
                  time.
                </Typography.Text>
                <Typography.Text>
                  <ul>
                    <li>
                      <Typography.Text strong={true}>namespace</Typography.Text>{" "}
                      — a UUID
                    </li>
                    <li>
                      <Typography.Text strong={true}>name</Typography.Text> —
                      can be anything
                    </li>
                    <li>
                      What is the difference between version-3 and version-5?
                    </li>
                  </ul>
                </Typography.Text>
                <Typography.Text>
                  Version-3 UUIDs are based on an MD5 hash of the name and
                  namespace.
                  <br />
                  Version-5 UUIDs are based on a SHA-1 hash of the name and
                  namespace. A SHA-1 hash is too long to be used in a UUID so it
                  is truncated.
                </Typography.Text>
                <Typography.Text>
                  The UUID specification establishes 4 pre-defined namespaces.
                  The pre-defined namespaces are:
                </Typography.Text>
                <Typography.Text>
                  <ul>
                    <li>
                      <Space direction={"horizontal"} size={8} align={"center"}>
                        <Typography.Text strong={true}>DNS</Typography.Text>—
                        <Typography.Text style={{ fontFamily: "monospace" }}>
                          6ba7b810-9dad-11d1-80b4-00c04fd430c8
                        </Typography.Text>
                        <Button
                          type={"text"}
                          icon={<CopyOutlined />}
                          onClick={async () => {
                            await copy(NAMESPACE_DNS);
                          }}
                        />
                      </Space>
                    </li>
                    <li>
                      <Space direction={"horizontal"} size={8} align={"center"}>
                        <Typography.Text strong={true}>URL</Typography.Text>—
                        <Typography.Text style={{ fontFamily: "monospace" }}>
                          6ba7b811-9dad-11d1-80b4-00c04fd430c8
                        </Typography.Text>
                        <Button
                          type={"text"}
                          icon={<CopyOutlined />}
                          onClick={async () => {
                            await copy(NAMESPACE_URL);
                          }}
                        />
                      </Space>
                    </li>
                    <li>
                      <Space direction={"horizontal"} size={8} align={"center"}>
                        <Typography.Text strong={true}>OID</Typography.Text>—
                        <Typography.Text style={{ fontFamily: "monospace" }}>
                          6ba7b812-9dad-11d1-80b4-00c04fd430c8
                        </Typography.Text>
                        <Button
                          type={"text"}
                          icon={<CopyOutlined />}
                          onClick={async () => {
                            await copy(NAMESPACE_OID);
                          }}
                        />
                      </Space>
                    </li>
                    <li>
                      <Space direction={"horizontal"} size={8} align={"center"}>
                        <Typography.Text strong={true}>
                          X.500 DN
                        </Typography.Text>
                        —
                        <Typography.Text style={{ fontFamily: "monospace" }}>
                          6ba7b814-9dad-11d1-80b4-00c04fd430c8
                        </Typography.Text>
                        <Button
                          type={"text"}
                          icon={<CopyOutlined />}
                          onClick={async () => {
                            await copy(NAMESPACE_X_500_DN);
                          }}
                        />
                      </Space>
                    </li>
                  </ul>
                </Typography.Text>
                {V35_INFO_PANEL}
              </Space>
            ),
          },
          {
            key: "v4",
            label: "Version 4",
            children: (
              <Space direction={"vertical"} size={8}>
                <Typography.Text>
                  Version-4 UUIDs are randomly generated. There are over 5.3 x
                  1036 unique v4 UUIDs. This is the most common UUID version.
                </Typography.Text>
                <Typography.Text>
                  Version-4, variant-2 is called a "GUID" on Microsoft systems.
                  GUIDs are a Microsoft implementation of DCE UUIDs. GUIDs
                  mostly conform to RFC4122. The only difference is in the byte
                  order.
                </Typography.Text>
                {V4_INFO_PANEL}
              </Space>
            ),
          },
        ]}
      />
    </Space>
  );
};
export default UUIDInfoPanel;
