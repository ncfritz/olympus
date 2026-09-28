import {
  CopyOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Space, Typography } from "antd";
import React, { useEffect, useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";
import { type UUIDGeneratorProps } from "./interfaces";

export interface UUIDRandomValueProps extends UUIDGeneratorProps {
  generate: () => string;
}

const UUIDRandomValue: React.FunctionComponent<UUIDRandomValueProps> = ({
  version,
  getInfo,
  generate,
}: UUIDRandomValueProps) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const [copiedValue, copy] = useCopyToClipboard();

  const [value, setValue] = useState<string | undefined>(undefined);

  useEffect(() => {
    setValue(generate());
  }, []);

  return (
    <Space
      direction={"horizontal"}
      size={8}
      style={{ display: "flex", alignItems: "center " }}
    >
      <Typography.Text
        style={{
          fontWeight: 600,
          justifyContent: "end",
          minWidth: 150,
          maxWidth: 150,
          display: "flex",
        }}
      >
        Version {version}:
      </Typography.Text>
      <Typography.Text
        style={{
          fontFamily: "monospace",
        }}
      >
        {value}
      </Typography.Text>
      <Button
        type={"text"}
        icon={<CopyOutlined />}
        disabled={!value}
        onClick={async () => {
          await copy(value!);
        }}
      />
      <Button
        type={"text"}
        icon={<InfoCircleOutlined />}
        disabled={!value}
        onClick={() => {
          getInfo(value!);
        }}
      />
      <Button
        type={"primary"}
        icon={<ReloadOutlined />}
        onClick={() => {
          setValue(generate());
        }}
      />
    </Space>
  );
};
export default UUIDRandomValue;
