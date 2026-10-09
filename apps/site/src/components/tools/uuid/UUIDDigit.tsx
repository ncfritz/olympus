import { Space } from "antd";
import React, { type CSSProperties } from "react";
import type { DigitType } from "./interfaces";

export interface UUIDDigitProps {
  value: string;
  selectedType?: string;
  type: DigitType;
  index: number;
}

const UUIDDigit: React.FunctionComponent<UUIDDigitProps> = ({
  value,
  type,
  selectedType,
  index,
}: UUIDDigitProps) => {
  let extraStyle: CSSProperties = {};

  if (selectedType && selectedType === type.label) {
    extraStyle = {
      border: "2px solid #000000",
      fontWeight: 600,
    };
  }

  console.log(type);

  return (
    <Space orientation={"vertical"} size={16}>
      <Space orientation={"vertical"} size={4}>
        <div
          style={{
            minWidth: 24,
            maxWidth: 24,
            height: 16,
            background: "#ffffff",
            borderRadius: 6,
            color: "#000000",
            justifyContent: "center",
            alignItems: "center",
            display: "flex",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        >
          {index}
        </div>
        <div
          style={{
            minWidth: 24,
            maxWidth: 24,
            height: 24,
            background: "#cccccc",
            borderRadius: 6,
            color: "#000000",
            justifyContent: "center",
            alignItems: "center",
            display: "flex",
            fontFamily: "monospace",
            fontSize: "12px",
            ...extraStyle,
          }}
        >
          {value}
        </div>
      </Space>
      <div
        style={{
          minWidth: 24,
          maxWidth: 24,
          height: 24,
          background: type.color,
          borderRadius: 6,
          color: "#ffffff",
          justifyContent: "center",
          alignItems: "center",
          display: "flex",
          fontSize: "12px",
        }}
      >
        {type.label}
      </div>
    </Space>
  );
};
export default UUIDDigit;
