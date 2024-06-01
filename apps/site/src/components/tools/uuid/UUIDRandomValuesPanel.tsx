import { Space } from "antd";
import React from "react";
import { v4 as uuidv4 } from "uuid";
import { NAMESPACE } from "./constants";
import { generate } from "./utils";
import UUIDRandomValue from "./UUIDRandomValue";

interface UUIDRandomValuesPanelProps {
  getInfo: (value: string) => void;
}

const UUIDRandomValuesPanel: React.FunctionComponent<
  UUIDRandomValuesPanelProps
> = ({ getInfo }: UUIDRandomValuesPanelProps) => {
  return (
    <Space direction={"vertical"} size={8}>
      <UUIDRandomValue
        version={1}
        getInfo={getInfo}
        generate={() => {
          return generate(1);
        }}
      />
      <UUIDRandomValue
        version={3}
        getInfo={getInfo}
        generate={() => {
          return generate(3, uuidv4(), NAMESPACE);
        }}
      />
      <UUIDRandomValue
        version={4}
        getInfo={getInfo}
        generate={() => {
          return generate(4);
        }}
      />
      <UUIDRandomValue
        version={5}
        getInfo={getInfo}
        generate={() => {
          return generate(5, uuidv4(), NAMESPACE);
        }}
      />
    </Space>
  );
};
export default UUIDRandomValuesPanel;
