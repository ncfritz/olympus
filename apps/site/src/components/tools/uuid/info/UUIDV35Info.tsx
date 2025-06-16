import { CopyOutlined } from "@ant-design/icons";
import { Button, Space, Typography } from "antd";
import type { ItemType } from "rc-collapse/es/interface";
import React from "react";
import {
  NAMESPACE_DNS,
  NAMESPACE_OID,
  NAMESPACE_URL,
  NAMESPACE_X_500_DN,
} from "../constants";
import { V35_INFO_PANEL } from "../infoPanels";
import { styles } from "./utils";

const UUIDV35Info = (copy: (text: string) => Promise<boolean>): ItemType => {
  return {
    key: "v35",
    label: "Version 3/5",
    styles: styles,
    children: (
      <Space direction={"vertical"} size={8}>
        <Typography.Text>
          Version-3 and version-5 are generated based on a "namespace" and
          unique "name". Namespace and name are concatenated and hashed. There
          is no temporal or random component to either versions so the same
          input produces the same output every time.
        </Typography.Text>
        <Typography.Text>
          <ul>
            <li>
              <Typography.Text strong={true}>namespace</Typography.Text> — a
              UUID
            </li>
            <li>
              <Typography.Text strong={true}>name</Typography.Text> — can be
              anything
            </li>
            <li>What is the difference between version-3 and version-5?</li>
          </ul>
        </Typography.Text>
        <Typography.Text>
          Version-3 UUIDs are based on an MD5 hash of the name and namespace.
          <br />
          Version-5 UUIDs are based on a SHA-1 hash of the name and namespace. A
          SHA-1 hash is too long to be used in a UUID so it is truncated.
        </Typography.Text>
        <Typography.Text>
          The UUID specification establishes 4 pre-defined namespaces. The
          pre-defined namespaces are:
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
                <Typography.Text strong={true}>X.500 DN</Typography.Text>—
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
  };
};
export default UUIDV35Info;
