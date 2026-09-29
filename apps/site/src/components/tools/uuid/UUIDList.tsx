import { CopyOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Button, Divider, List, Space, Typography } from "antd";
import React from "react";
import { useCopyToClipboard } from "usehooks-ts";

export interface UUIDListProps {
  values?: string[];
  getInfo: (value: string) => void;
}

const UUIDList: React.FunctionComponent<UUIDListProps> = ({
  values,
  getInfo,
}: UUIDListProps) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const [, copy] = useCopyToClipboard();

  return values && values?.length > 0 ? (
    <Space
      direction={"vertical"}
      size={16}
      style={{
        display: "flex",
        alignItems: "baseline",
      }}
    >
      <Space orientation={"vertical"} size={4} style={{ width: "100%" }}>
        <Divider />
        <List
          style={{
            minWidth: 750,
            maxWidth: 750,
          }}
          grid={{
            gutter: 16,
            column: 2,
          }}
          dataSource={values}
          renderItem={(item) => {
            return (
              <>
                <Typography.Text style={{ fontFamily: "monospace" }}>
                  {item}
                </Typography.Text>
                <Button
                  type={"text"}
                  icon={<InfoCircleOutlined />}
                  onClick={() => {
                    getInfo(item);
                  }}
                />
                <Button
                  type={"text"}
                  icon={<CopyOutlined />}
                  onClick={async () => {
                    await copy(item);
                  }}
                />
              </>
            );
          }}
        />
      </Space>
    </Space>
  ) : (
    <></>
  );
};
export default UUIDList;
