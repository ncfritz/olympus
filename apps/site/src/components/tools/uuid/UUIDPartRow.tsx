import { Space, Typography } from "antd";
import React, { type CSSProperties, type ReactNode } from "react";
import { type DigitType } from "./interfaces";

export interface UUIDPartRowProps {
  label: string;
  types: DigitType[];
  description: ReactNode;
  onHover?: (value?: string) => void;
}

const UUIDPartRow: React.FunctionComponent<UUIDPartRowProps> = ({
  label,
  types,
  description,
  onHover,
}: UUIDPartRowProps) => {
  let hoverStyle: CSSProperties = {};

  if (onHover) {
    hoverStyle = { cursor: "pointer" };
  }

  return (
    <Space direction={"horizontal"} size={8} align={"baseline"}>
      <Typography.Text
        style={{
          justifyContent: "end",
          width: 150,
          display: "flex",
          fontWeight: 600,
          fontFamily: "monospace",
        }}
      >
        {label}
      </Typography.Text>
      {types.map((type: DigitType) => {
        return (
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
              ...hoverStyle,
            }}
            onMouseEnter={() => {
              onHover && onHover(type.label);
            }}
            onMouseLeave={() => {
              onHover && onHover(undefined);
            }}
          >
            {type.label}
          </div>
        );
      })}
      {"-"}
      {description}
    </Space>
  );
};
export default UUIDPartRow;
