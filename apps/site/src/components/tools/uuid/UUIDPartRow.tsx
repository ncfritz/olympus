import { Space, Typography } from "antd";
import React, { type CSSProperties, type ReactNode } from "react";
import { type DigitType } from "./interfaces";
import { v4 as uuidv4 } from "uuid";

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
    <Space orientation={"horizontal"} size={8} align={"baseline"}>
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
            key={uuidv4()}
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
              onHover?.(type.label);
            }}
            onMouseLeave={() => {
              onHover?.(undefined);
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
