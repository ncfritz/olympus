import { Collapse, Space, Typography } from "antd";
import React from "react";
import { useCopyToClipboard } from "usehooks-ts";
import UUIDV1Info from "./info/UUIDV1Info";
import UUIDV35Info from "./info/UUIDV35Info";
import UUIDV4Info from "./info/UUIDV4Info";
import UUIDV6Info from "./info/UUIDV6Info";
import UUIDV7Info from "./info/UUIDV7Info";

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
        style={{
          marginTop: 8,
        }}
        items={[
          UUIDV1Info,
          UUIDV35Info(copy),
          UUIDV4Info,
          UUIDV6Info,
          UUIDV7Info,
        ]}
      />
    </Space>
  );
};
export default UUIDInfoPanel;
